BASE_INSTRUCTIONS = '''
You are extracting a specific section from an IEP document.
Locate the section titled "IEP meeting notes" (or similar variations like "Meeting Notes", "IEP Meeting Notes", etc.).
Extract the ENTIRE content of that section WORD-FOR-WORD with NO paraphrasing, summarization, or changes.

Return ONLY valid JSON in this format:
{
  "meeting_notes": "The complete verbatim text from the IEP meeting notes section"
}

If the section is not found, return:
{
  "meeting_notes": ""
}

Do not analyze, summarize, or modify the text in any way. Return it exactly as written.
'''

SYSTEM_PROMPT = "You are a precise document extraction assistant that returns text exactly as written."

