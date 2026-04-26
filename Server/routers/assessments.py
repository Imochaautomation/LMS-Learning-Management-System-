import os, uuid, shutil
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session

from database import get_db
from models import User, AssessmentAssignment, AssessmentBankItem, Notification
from schemas import AssessmentAssignRequest, AssessmentAssignOut
from auth import get_current_user, require_role
from config import UPLOAD_DIR, OPENROUTER_API_KEY, MODEL_NAME

import httpx

router = APIRouter(prefix="/api/assessments", tags=["assessments"])

SUBMISSION_DIR = os.path.join(UPLOAD_DIR, "submissions")


async def _generate_ai_summary(filename: str, assessment_name: str, file_path: str = None, assessment_file_path: str = None, assessment_type: str = "full") -> tuple[str, float]:
    """Call OpenRouter LLM to generate an AI review summary and score.

    For assessment_type='proofreading': evaluates the submission as a proofreading/editing task
    using US English standards — compares original vs edited version.
    For all other types: evaluates whether the learner answered the questions correctly.
    """

    def _read_file_content(fpath: str, max_chars: int = 8000) -> str:
        """Extract text from a file (PDF, DOCX, CSV, TXT, etc.)."""
        if not fpath or not os.path.exists(fpath):
            return ""
        try:
            ext = os.path.splitext(fpath)[1].lower()
            if ext == '.pdf':
                try:
                    import PyPDF2
                    with open(fpath, 'rb') as f:
                        reader = PyPDF2.PdfReader(f)
                        text = ""
                        for page in reader.pages[:15]:
                            text += page.extract_text() or ""
                        if text.strip():
                            return text[:max_chars]
                except (ImportError, Exception):
                    pass
                try:
                    import pdfplumber
                    with pdfplumber.open(fpath) as pdf:
                        text = ""
                        for page in pdf.pages[:15]:
                            text += (page.extract_text() or "")
                        if text.strip():
                            return text[:max_chars]
                except (ImportError, Exception):
                    pass
                return "[PDF file — content extraction unavailable]"
            elif ext in ('.doc', '.docx'):
                try:
                    import docx
                    doc = docx.Document(fpath)
                    text = "\n".join([p.text for p in doc.paragraphs[:100]])
                    return text[:max_chars]
                except ImportError:
                    return "[Word file — content extraction unavailable]"
            elif ext == '.csv':
                return _parse_csv_with_edits(fpath, max_chars)
            elif ext in ('.txt', '.md'):
                with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                    return f.read(max_chars)
            elif ext in ('.xlsx', '.xls'):
                return _parse_excel_with_edits(fpath, max_chars)
            else:
                return "[Binary format file]"
        except Exception:
            return ""

    def _parse_csv_with_edits(fpath: str, max_chars: int) -> str:
        """Parse a CSV file and produce a structured diff of original vs Edited columns.

        Columns named 'Edited X' are the learner's corrections to column 'X'.
        Returns a human-readable diff per row so the AI can evaluate each edit.
        """
        import csv, io
        try:
            with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                raw = f.read()
            reader = csv.DictReader(io.StringIO(raw))
            headers = reader.fieldnames or []

            # Identify original→edited column pairs
            edited_map = {}   # "Edited Foo" -> "Foo"
            original_cols = []
            for h in headers:
                h_stripped = h.strip()
                if h_stripped.startswith("Edited "):
                    base = h_stripped[len("Edited "):]
                    edited_map[h_stripped] = base
                else:
                    original_cols.append(h_stripped)

            has_edits = bool(edited_map)
            lines = []
            key_cols = ['Question Text', 'Question Type', 'Difficulty Level', 'Option (A)', 'Option (B)',
                        'Option (C)', 'Option (D)', 'Correct Answer', 'Answer Explanation', 'Topics']

            for row_num, row in enumerate(reader, 1):
                row_clean = {k.strip(): v.strip() if v else '' for k, v in row.items()}
                # Show original question text as the row anchor — never use edited
                orig_q = row_clean.get('Question Text', '')
                q_preview = orig_q[:100] + ('...' if len(orig_q) > 100 else '')
                lines.append(f"\n╔══ ROW {row_num} ══╗")
                lines.append(f"  ORIGINAL QUESTION: {q_preview}")

                if has_edits:
                    diff_found = False
                    for edited_col, base_col in edited_map.items():
                        # Skip Question Text in the diff — it's already shown as the row anchor
                        if base_col in ('Question Text',):
                            orig_val = row_clean.get(base_col, '')
                            edited_val = row_clean.get(edited_col, '')
                            if orig_val != edited_val and edited_val:
                                lines.append(f"  [Question Text] ORIGINAL→EDITED (summarized)")
                                # Show only first 100 chars of each to save space
                                lines.append(f"    ORIG : {orig_val[:100]}")
                                lines.append(f"    EDIT : {edited_val[:100]}")
                                diff_found = True
                            continue
                        orig_val = row_clean.get(base_col, '')
                        edited_val = row_clean.get(edited_col, '')
                        if not orig_val and not edited_val:
                            continue
                        if orig_val != edited_val and edited_val:
                            lines.append(f"  [{base_col}] ORIG: {orig_val[:150]} | EDIT: {edited_val[:150]}")
                            diff_found = True
                        elif orig_val and not edited_val:
                            lines.append(f"  [{base_col}]: not edited")
                    if not diff_found:
                        lines.append("  >> NO CHANGES MADE TO THIS ROW <<")
                else:
                    for col in key_cols:
                        val = row_clean.get(col, '')
                        if val:
                            lines.append(f"  {col}: {val[:200]}")

            result = "\n".join(lines)
            if not has_edits:
                result = "[NOTE: No 'Edited X' columns detected — showing raw content]\n" + result
            else:
                result = (
                    f"[CSV PROOFREADING SUBMISSION — EXACTLY {row_num} ROWS TOTAL]\n"
                    f"[There are NO rows beyond row {row_num}. Do not reference any row number greater than {row_num}.]\n"
                    f"[Each ╔══ ROW N ══╗ block below is the complete data for that row. Evaluate ONLY these rows.]\n\n"
                ) + result
            return result[:max_chars]
        except Exception as ex:
            # Fallback: raw read
            try:
                with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                    return f.read(max_chars)
            except Exception:
                return f"[CSV parse error: {ex}]"

    def _parse_excel_with_edits(fpath: str, max_chars: int) -> str:
        """Parse an Excel file, detecting original vs Edited column pairs."""
        try:
            import openpyxl
            wb = openpyxl.load_workbook(fpath, data_only=True)
            ws = wb.active
            rows = list(ws.iter_rows(values_only=True))
            if not rows:
                return "[Empty Excel file]"
            headers = [str(h).strip() if h else '' for h in rows[0]]
            edited_map = {}
            for h in headers:
                if h.startswith("Edited "):
                    edited_map[h] = h[len("Edited "):]
            has_edits = bool(edited_map)
            lines = [f"[Excel PROOFREADING SUBMISSION — {len(rows)-1} rows]"]
            for row_num, row in enumerate(rows[1:], 1):
                row_dict = {headers[i]: (str(row[i]).strip() if row[i] is not None else '') for i in range(len(headers))}
                lines.append(f"\n--- ROW {row_num} ---")
                if has_edits:
                    for edited_col, base_col in edited_map.items():
                        orig_val = row_dict.get(base_col, '')
                        edited_val = row_dict.get(edited_col, '')
                        if orig_val != edited_val and edited_val:
                            lines.append(f"  [{base_col}] ORIGINAL: {orig_val[:150]} | EDITED: {edited_val[:150]}")
                else:
                    for h, v in row_dict.items():
                        if v:
                            lines.append(f"  {h}: {v[:150]}")
            return "\n".join(lines)[:max_chars]
        except ImportError:
            return "[Excel file — openpyxl not installed]"
        except Exception as ex:
            return f"[Excel parse error: {ex}]"

    # Use higher char limit for CSV proofreading — each row diff can be large
    ext_lower = os.path.splitext(filename)[1].lower() if filename else ''
    csv_mode = ext_lower in ('.csv', '.xlsx', '.xls')
    content_limit = 20000 if csv_mode else 8000

    # Read submission content
    submission_content = _read_file_content(file_path, max_chars=content_limit)
    if not submission_content:
        submission_content = f"[File submitted: {filename}]"

    # Read original assessment content (questions)
    assessment_content = ""
    if assessment_file_path:
        # assessment_file_path is like "/uploads/assessments/abc.docx"
        abs_assess_path = os.path.join(UPLOAD_DIR, "..", assessment_file_path.lstrip("/"))
        abs_assess_path = os.path.normpath(abs_assess_path)
        assessment_content = _read_file_content(abs_assess_path, max_chars=8000)

    if not OPENROUTER_API_KEY:
        word_count = len(submission_content.split()) if submission_content else 0
        if word_count < 10:
            return ("⚠️ The submission appears to be empty or contains very little content. Please resubmit with a completed assessment.", 15.0)
        return (
            f"Assessment '{assessment_name}' reviewed. "
            f"The submission contains {word_count} words. "
            f"Manual review recommended for detailed feedback.", 65.0
        )

    is_proofreading = assessment_type == "proofreading"

    if is_proofreading:
        system_prompt = """You are an EXPERT US English proofreading evaluator for a professional LMS training platform. The learner's job was to PROOFREAD and EDIT a given document — NOT to answer questions, but to find and fix all errors in the text.

FILE FORMAT AWARENESS:
- If the submission is a CSV file with "Edited X" columns: each "Edited X" column is the learner's corrected version of column "X". Compare them row by row. Treat each row as one question/item to evaluate.
- If the submission is a PDF or DOCX: compare the full text of the original vs the edited version.
- In both cases, focus entirely on language quality: grammar, spelling, punctuation, US English conventions, clarity, and style.

US ENGLISH STANDARDS to enforce:
- Spelling: color/colour, organize/organise, analyze/analyse, traveled/travelled, center/centre, etc.
- Punctuation: Oxford comma mandatory in lists of 3+, double quotation marks (""), em-dash (—) for breaks
- Grammar: subject-verb agreement, tense consistency, pronoun agreement, modifier placement, parallel structure
- Style: active voice preferred, no redundant words, sentence clarity
- Capitalization: proper nouns, product names (JavaScript not Javascript, Python not python, C++ not c++)
- Number/currency formatting: $1,000 not 1,000$; numbers formatted consistently

SCORING BREAKDOWN (total 100):
- Errors Caught & Fixed Correctly (0-40): Every real error correctly identified and fixed. Award partial credit.
- No Incorrect Edits (0-25): Penalize only for changes that break correct text or alter meaning without fixing a real error.
- US English Compliance (0-20): Overall adherence to US English conventions throughout the document.
- Completeness (0-15): Did the learner review ALL rows/sections, or did they skip large portions?

CRITICAL RULES:
1. No edits at all → Score 0-10, authentic=false.
2. Unrelated document → Score 0-10, authentic=false, fill submission_mismatch_reason.
3. Be FAIR and GENEROUS for genuine effort — partial fixes deserve partial credit.
4. For CSV: evaluate EVERY row shown in the input. A row with no edits is NOT necessarily wrong if that row had no errors.
5. Flag only genuine content-meaning changes as "incorrect edits" — do NOT penalize stylistic improvements.
6. TECHNICAL TERM RULE: In programming/JS questions: null, undefined, NaN, ReferenceError, TypeError, console.log, etc. are exact technical terms — changing their casing (null→Null, undefined→Undefined) or splitting them (ReferenceError→Reference Error) is a WRONG edit. Do NOT count these as correct fixes.
7. ANTI-HALLUCINATION RULE: Every row, every question, every error you mention MUST be taken verbatim from the input. If it is not in the input, do not mention it. Do not invent rows beyond the total shown, do not invent question content, do not copy findings from a different assessment.
8. SCORE INTEGRITY: The total score field MUST equal the sum of errors_caught_score + incorrect_edits_score + us_english_score + completeness_score. Verify this arithmetic before returning.
9. CURRENCY FORMATTING RULE: Moving the $ sign from after the number to before it (e.g., 500000$ → $500,000 or 1,500,000$ → $1,500,000) is a CORRECT US English currency fix. Always credit this. Never penalize it. The only wrong currency edit is removing $ entirely or changing the number value.
10. ENCODING/GARBLED CHARACTER RULE: If the edited text contains garbled/corrupted characters such as Í, ñ, î, ï, æ, ´, or other non-standard Unicode replacing normal apostrophes, quotes, or punctuation — this is a WRONG edit. Flag it as "introduced garbled encoding characters" and penalize it. Examples: "managerÍs" instead of "manager's", "ñHello, World!î" instead of '"Hello, World!"', "ïFormat DocumentÍ" instead of "'Format Document'".
11. MATH ACCURACY RULE: If the edited answer explanation contains a mathematical calculation, verify it. If the calculation is wrong (e.g., 15,000/30,000 = 0.5 = 50% when the answer option says 37.5%), flag it as an incorrect edit — the learner introduced a wrong calculation.
12. CONTRADICTION CHECK: Before finalizing, check that nothing in missed_questions contradicts per_question_marks. If a row's per_question_marks already credits a fix, do not also list it as missed in missed_questions.

PER-ROW/PER-QUESTION MARKING (REQUIRED):
You MUST populate "per_question_marks" — one entry per CSV row or document section — with:
- What the learner fixed correctly (direct quote where possible: "X → Y")
- What errors they missed (direct quote: "word X should be Y")
- What they changed incorrectly (direct quote: "changed X to Y — incorrect because...")
- Marks awarded out of marks possible for that row

Return ONLY valid JSON in this EXACT structure (no markdown, no extra text):
{
  "summary": "3-5 sentence overview of the proofreading quality",
  "score": 72,
  "authentic": true,
  "submission_mismatch_reason": null,
  "questions_answered": null,
  "questions_total": null,
  "content_relevance_score": null,
  "completeness_score": 12,
  "grammar_score": null,
  "accuracy_score": null,
  "errors_caught_score": 30,
  "incorrect_edits_score": 20,
  "us_english_score": 16,
  "per_question_marks": [
    {
      "row": 1,
      "question_preview": "You are managing a project...",
      "correct_fixes": ["'stakholders' → 'stakeholders'", "'Software application' → 'software application'", "'there concerns' → 'their concerns'"],
      "missed_errors": ["Option A meaning was unnecessarily changed"],
      "incorrect_edits": [],
      "marks_awarded": 3,
      "marks_possible": 4,
      "note": "Good job on spelling. One option text was changed beyond proofreading scope."
    }
  ],
  "grammar_mistakes": [
    {"location": "Row 2, Answer Explanation", "error": "Flagged as 'Incorrect Explanation' — the explanation does not match the correct answer option", "correction": "Explanation should match option D, not option B"}
  ],
  "wrong_answers": [
    {"question": "Row 1, Option A original", "learner_answer": "Changed option A wording to different meaning", "correct_answer": "Should only fix grammar/spelling, not rewrite content", "explanation": "Content meaning was altered — this is outside proofreading scope"}
  ],
  "missed_questions": ["Row 4: 'analysing' → 'analyzing' missed (US English)", "Row 16: currency format '1,500,000$' should be '$1,500,000' — missed"],
  "strengths": ["Consistently fixed British spelling to US English", "Correctly updated difficulty levels (Meduim→Medium, Difficult→Hard)", "Fixed all capitalization issues (c++→C++, python→Python, javascript→JavaScript)"],
  "areas_of_improvement": ["Some Oxford comma opportunities missed", "Currency formatting not standardized"],
  "detailed_feedback": "Row-by-row summary: Row 1 — good fixes on spelling and grammar. Row 2 — correctly flagged wrong explanation. Row 3 — 'Apologise'→'Apologize' correctly fixed. ..."
}
NOTE: errors_caught_score 0-40, incorrect_edits_score 0-25, us_english_score 0-20, completeness_score 0-15. Sum = total score.
per_question_marks must have one entry per row/section. This is the most important part of the report."""

        user_message = f"""Assessment Name: {assessment_name} [PROOFREADING TASK]
Submitted File: {filename}

════════════════════════════════════════
ABSOLUTE RULE — READ THIS FIRST:
You MUST evaluate ONLY what is shown below. Do NOT invent rows, questions, or content that is not present in the input. Every row number, question snippet, and change you report MUST come directly from the data below. If you hallucinate content not shown here, the evaluation is invalid.
════════════════════════════════════════

{"=== CSV PROOFREADING SUBMISSION ===" if filename.lower().endswith('.csv') else "=== DOCUMENT SUBMISSION ==="}
{"Each ROW block below shows EXACTLY what the learner changed. ORIGINAL = the original text. EDITED = the learner's version. If both are identical, NO change was made to that column." if filename.lower().endswith('.csv') else ""}

{submission_content if submission_content else "[No submission content could be extracted]"}

{"=== ORIGINAL ASSESSMENT FILE (for reference) ===" if assessment_content else ""}
{assessment_content if assessment_content else ""}

════════════════════════════════════════
EVALUATION INSTRUCTIONS:
1. Work through EVERY ROW shown above, in order. Your per_question_marks array must have exactly one entry per ROW shown, numbered to match.
2. For each row: identify every ORIGINAL→EDITED change. Judge each change: correct fix, incorrect edit, or missed error.
3. Use the ORIGINAL text shown to identify what errors existed. Use the EDITED text to see what the learner changed.
4. NEVER reference a row number, question text, or error that is not explicitly present in the data above.
5. NEVER reference content from any document other than what is shown above.
6. WRONG edits to penalize: changing JS keywords casing (null→Null, undefined→Undefined, ReferenceError→Reference Error), introducing garbled characters (Í ñ î ï æ ´ replacing normal punctuation), duplicating text blocks, wrong math in explanations.
7. CORRECT edits to credit: currency $ moved before number (500$ → $500, 1,500,000$ → $1,500,000), British→US spelling, grammar fixes, capitalization of proper nouns (JavaScript, Python, C++, C#, Node.js), adding missing articles/commas, fixing typos.
8. Score MUST equal errors_caught_score + incorrect_edits_score + us_english_score + completeness_score. Check arithmetic.
9. Nothing in missed_questions should contradict per_question_marks. If you credited a fix in per_question_marks, do not also list it as missed.
════════════════════════════════════════"""

    else:
        # Standard answer-based evaluation
        system_prompt = """You are an EXPERT and STRICT assessment evaluator for a professional LMS training platform. Your role is to provide a highly detailed, question-by-question evaluation of the learner's submission.

YOUR JOB: Compare the ORIGINAL ASSESSMENT (questions/tasks) with the LEARNER'S SUBMISSION and produce a thorough, professional evaluation report.

CRITICAL RULES:
1. If the submission is NOT related to the assessment (e.g., a resume, random document, cover letter, completely unrelated content) → Score 0-15, flag as INVALID SUBMISSION.
2. If the submission is partially related but misses most questions → Score 15-40.
3. If the submission answers questions but with significant errors, grammar issues, or incomplete answers → Score 40-65.
4. Only give 65-80 for good answers with minor errors.
5. Only give 80-92 for very good, mostly correct answers with professional quality.
6. Only give 92-100 for truly excellent, thorough, and accurate answers.

SCORING BREAKDOWN (total 100):
- Content Relevance (0-30): Does the submission ACTUALLY answer the assessment questions? Wrong document = 0.
- Completeness (0-25): Are ALL questions/tasks addressed? Missing answers = heavy deduction.
- Grammar & Language Quality (0-20): Is the writing professional? Check for grammar errors, spelling mistakes, punctuation issues, sentence structure, and clarity.
- Accuracy & Correctness (0-25): Are the actual answers factually/technically CORRECT? Identify wrong answers specifically.

IMPORTANT: Be skeptical and strict. Do NOT give high scores just because a document has lots of text.
MISMATCH DETECTION: If the assigned assessment topic (e.g., "Grammar Assessment") does not match what was submitted (e.g., a resume, cover letter, or a completely different assignment) — set authentic=false and fill submission_mismatch_reason with a clear explanation of what was expected vs what was received.

Return ONLY valid JSON in this EXACT structure (no markdown, no extra text):
{
  "summary": "3-5 sentence professional overview of the submission quality and how well it matches the assessment",
  "score": 45,
  "authentic": true,
  "submission_mismatch_reason": null,
  "questions_answered": 3,
  "questions_total": 5,
  "content_relevance_score": 14,
  "completeness_score": 11,
  "grammar_score": 10,
  "accuracy_score": 10,
  "errors_caught_score": null,
  "incorrect_edits_score": null,
  "us_english_score": null,
  "grammar_mistakes": [
    {"location": "Question 2 answer", "error": "Subject-verb agreement error: 'The teams was present'", "correction": "The teams were present"},
    {"location": "Introduction paragraph", "error": "Missing comma after introductory clause", "correction": "After 'However,' add a comma"}
  ],
  "wrong_answers": [
    {"question": "Q3: What is active voice?", "learner_answer": "When the subject receives the action", "correct_answer": "When the subject performs the action", "explanation": "The learner confused active and passive voice definitions"}
  ],
  "missed_questions": ["Q4: No answer provided for the paragraph rewriting task"],
  "strengths": ["Good understanding of passive voice transformation in Q1"],
  "areas_of_improvement": ["Subject-verb agreement needs practice"],
  "detailed_feedback": "Paragraph-by-paragraph or question-by-question detailed feedback here."
}
NOTE on per-category scores: content_relevance_score must be 0-30, completeness_score 0-25, grammar_score 0-20, accuracy_score 0-25. Their sum should equal the total score."""

        user_message = f"""Assessment Name: {assessment_name}

--- ORIGINAL ASSESSMENT (Questions/Tasks) ---
{assessment_content if assessment_content else "[Assessment file content not available — evaluate submission on its own merit but be VERY STRICT about relevance to the assessment topic: '{assessment_name}']"}
--- END ASSESSMENT ---

--- LEARNER'S SUBMISSION ---
Submitted File: {filename}
{submission_content}
--- END SUBMISSION ---

Provide a thorough question-by-question evaluation. Identify every grammar mistake, every wrong answer, every missed question. Be specific and constructive. Score strictly."""

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}"},
                json={
                    "model": MODEL_NAME,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message}
                    ],
                },
            )
            data = resp.json()
            if "error" in data:
                err = data["error"]
                raise Exception(f"OpenRouter API error {err.get('code', '')}: {err.get('message', str(err))}")
            if "choices" not in data or not data["choices"]:
                raise Exception(f"Unexpected API response (no choices): {str(data)[:300]}")
            content = data["choices"][0]["message"]["content"]
            import json
            try:
                cleaned = content.strip()
                if cleaned.startswith("```"):
                    cleaned = cleaned.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
                parsed = json.loads(cleaned)
                summary_text = parsed.get("summary", content)
                score = float(parsed.get("score", 40))
                authentic = parsed.get("authentic", True)
                if not authentic:
                    summary_text = f"⚠️ FLAGGED: {summary_text}"
                    score = min(score, 25)
                import json as _json
                rich_summary = _json.dumps({
                    "summary": summary_text,
                    "assessment_type": assessment_type,
                    "questions_answered": parsed.get("questions_answered"),
                    "questions_total": parsed.get("questions_total"),
                    "content_relevance_score": parsed.get("content_relevance_score"),
                    "completeness_score": parsed.get("completeness_score"),
                    "grammar_score": parsed.get("grammar_score"),
                    "accuracy_score": parsed.get("accuracy_score"),
                    "errors_caught_score": parsed.get("errors_caught_score"),
                    "incorrect_edits_score": parsed.get("incorrect_edits_score"),
                    "us_english_score": parsed.get("us_english_score"),
                    "submission_mismatch_reason": parsed.get("submission_mismatch_reason"),
                    "grammar_mistakes": parsed.get("grammar_mistakes", []),
                    "wrong_answers": parsed.get("wrong_answers", []),
                    "missed_questions": parsed.get("missed_questions", []),
                    "per_question_marks": parsed.get("per_question_marks", []),
                    "strengths": parsed.get("strengths", []),
                    "areas_of_improvement": parsed.get("areas_of_improvement", []),
                    "detailed_feedback": parsed.get("detailed_feedback", ""),
                    "authentic": authentic,
                })
                return rich_summary, score
            except Exception:
                return content[:800], 40.0
    except Exception as e:
        return f"AI Review of '{assessment_name}': Review completed with limited analysis. {str(e)[:80]}", 50.0


@router.post("/assign", response_model=AssessmentAssignOut)
def assign_assessment(
    req: AssessmentAssignRequest,
    manager: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
):
    target = db.query(User).filter(User.id == req.user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    file_path = None
    if req.assessment_bank_id:
        bank_item = db.query(AssessmentBankItem).filter(AssessmentBankItem.id == req.assessment_bank_id).first()
        if bank_item and bank_item.file_path:
            file_path = bank_item.file_path

    assignment = AssessmentAssignment(
        user_id=req.user_id,
        assigned_by=manager.id,
        assessment_name=req.assessment_name,
        assessment_file_path=file_path,
        assessment_type=req.assessment_type,
        target_area=req.target_area,
        note=req.note,
    )
    db.add(assignment)

    notif = Notification(
        user_id=req.user_id,
        title=f"New Assessment Assigned: {req.assessment_name}",
        message=f"{manager.name} assigned you assessment '{req.assessment_name}'.",
        type="assignment",
    )
    db.add(notif)
    db.commit()
    db.refresh(assignment)

    out = AssessmentAssignOut.model_validate(assignment)
    out.user_name = target.name
    out.assigner_name = manager.name
    out.user_role = target.role
    return out


@router.get("/my", response_model=list[AssessmentAssignOut])
def my_assessments(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.user_id == user.id
    ).order_by(AssessmentAssignment.assigned_at.desc()).all()
    result = []
    for a in items:
        out = AssessmentAssignOut.model_validate(a)
        out.user_name = a.user.name
        out.assigner_name = a.assigner.name
        out.user_role = a.user.role
        result.append(out)
    return result


@router.get("/all", response_model=list[AssessmentAssignOut])
def all_assessments(
    manager: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
):
    items = db.query(AssessmentAssignment).order_by(AssessmentAssignment.assigned_at.desc()).all()
    result = []
    for a in items:
        out = AssessmentAssignOut.model_validate(a)
        out.user_name = a.user.name
        out.assigner_name = a.assigner.name
        out.user_role = a.user.role
        result.append(out)
    return result


@router.get("/assigned", response_model=list[AssessmentAssignOut])
def assigned_assessments(
    user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Get assessments assigned to a specific user (used by manager LearnerDetail)."""
    items = db.query(AssessmentAssignment).filter(
        AssessmentAssignment.user_id == user_id
    ).order_by(AssessmentAssignment.assigned_at.desc()).all()
    result = []
    for a in items:
        out = AssessmentAssignOut.model_validate(a)
        out.user_name = a.user.name
        out.assigner_name = a.assigner.name
        out.user_role = a.user.role
        result.append(out)
    return result


@router.patch("/{assignment_id}/status")
def update_status(
    assignment_id: int,
    status: str = Query(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    a = db.query(AssessmentAssignment).filter(AssessmentAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if status not in ("pending", "downloaded", "submitted", "reviewed"):
        raise HTTPException(status_code=400, detail="Invalid status")
    a.status = status
    db.commit()

    # Notify manager on status change
    if status == 'downloaded':
        managers = db.query(User).filter(User.role == 'manager').all()
        for m in managers:
            notif = Notification(
                user_id=m.id,
                title=f"Assessment Downloaded",
                message=f"📥 {user.name} downloaded assessment '{a.assessment_name}'",
                type="info",
            )
            db.add(notif)
        db.commit()
    return {"ok": True}


@router.post("/{assignment_id}/submit")
async def submit_assessment(
    assignment_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    a = db.query(AssessmentAssignment).filter(AssessmentAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if a.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your assignment")

    ext = os.path.splitext(file.filename)[1]
    fname = f"{user.id}_{assignment_id}_{uuid.uuid4().hex[:8]}{ext}"
    path = os.path.join(SUBMISSION_DIR, fname)
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    a.submission_path = f"/uploads/submissions/{fname}"
    a.submission_file = file.filename
    a.status = "submitted"
    a.submitted_at = datetime.utcnow()

    summary, score = await _generate_ai_summary(
        file.filename, a.assessment_name,
        file_path=path,
        assessment_file_path=a.assessment_file_path,
        assessment_type=a.assessment_type or "full",
    )
    a.ai_summary = summary
    a.score = score

    db.commit()

    # Notify managers — simple one-liner
    managers = db.query(User).filter(User.role == "manager").all()
    for m in managers:
        notif = Notification(
            user_id=m.id,
            title=f"Assessment Submitted",
            message=f"📝 {user.name} submitted assessment '{a.assessment_name}'",
            type="assignment",
        )
        db.add(notif)
    db.commit()

    return {"ok": True, "submission_path": a.submission_path, "ai_summary": summary, "score": score}


@router.get("/{assignment_id}/report")
def get_assessment_report(
    assignment_id: int,
    db: Session = Depends(get_db),
):
    """Return detailed JSON report for a submitted/reviewed assessment (for PDF modal)."""
    a = db.query(AssessmentAssignment).filter(AssessmentAssignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")

    score = a.score or 0
    return {
        "id": a.id,
        "assessment_name": a.assessment_name,
        "user_name": a.user.name if a.user else "Unknown",
        "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
        "submission_file": a.submission_file,
        "score": score,
        "ai_summary": a.ai_summary,
        "breakdown": [
            {"label": "Content Relevance", "max": 30, "score": round(score * 0.30)},
            {"label": "Completeness", "max": 25, "score": round(score * 0.25)},
            {"label": "Quality & Accuracy", "max": 25, "score": round(score * 0.25)},
            {"label": "Authenticity", "max": 20, "score": round(score * 0.20)},
        ],
        "status": a.status,
    }
