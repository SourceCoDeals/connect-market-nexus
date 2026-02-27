#!/usr/bin/env python3
"""
Decision Makers Finder — Standalone CLI Tool
=============================================

Discovers key decision makers (CEO, founders, presidents, VPs, etc.) at
companies using Serper Google Search and GPT-4o-mini (via OpenRouter) for
structured extraction.

Usage:
    python decision_makers_finder.py <input_file_or_url> [output_file]

Examples:
    python decision_makers_finder.py input.xlsx
    python decision_makers_finder.py input.csv output.csv
    python decision_makers_finder.py https://docs.google.com/spreadsheets/d/...
    python decision_makers_finder.py https://docs.google.com/spreadsheets/d/... custom_output.csv

Input format:
    - Excel (.xlsx/.xls) or CSV with columns: "Domain", "Company Name"
    - Public or shared Google Sheets URL with the same columns

Required environment variables (set in .env):
    SERPER_API_KEY      — https://serper.dev
    OPENROUTER_API_KEY  — https://openrouter.ai
"""

import asyncio
import aiohttp
import pandas as pd
import json
import os
from dotenv import load_dotenv
from typing import List, Dict, Any
import sys
import gspread
from google.auth.exceptions import DefaultCredentialsError
import re
from urllib.parse import urlparse, parse_qs

# Load environment variables
load_dotenv()

SERPER_API_KEY = os.getenv('SERPER_API_KEY')
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')

if not SERPER_API_KEY or not OPENROUTER_API_KEY:
    print("Error: Please set SERPER_API_KEY and OPENROUTER_API_KEY in .env file")
    sys.exit(1)


class DecisionMakersFinder:
    def __init__(self):
        self.serper_url = "https://google.serper.dev/search"
        self.openrouter_url = "https://openrouter.ai/api/v1/chat/completions"

        # With 50 req/sec and 7 queries per company, we can do ~7 companies in parallel
        self.batch_size = 14

        # Search queries for different roles
        self.search_queries = [
            "{domain} {company_name} CEO -zoominfo -dnb",
            "{domain} {company_name} Founder owner -zoominfo -dnb",
            "{domain} {company_name} president chairman -zoominfo -dnb",
            "{domain} {company_name} partner -zoominfo -dnb",
            "{domain} {company_name} contact email"
        ]

        self.llm_combined_prompt = """You are an expert assistant for structured data extraction. Your task is to analyze a list of Google search result objects in JSON format. Each object contains a "title", "link" and "snippet".

Your goal is to identify ALL relevant contacts including:
1. High-level decision-makers (C-level executives, founders, owners)
2. Mid-level contacts (VPs, General Managers)
3. Generic company contact emails

Return a list of all contacts in structured JSON format.

---

RULES TO FOLLOW:

1. Loop through each search result object.
2. Look for the following types of contacts:

   **HIGH-LEVEL DECISION MAKERS:**
   - Owner
   - Founder / Co-Founder
   - CEO
   - CFO
   - President
   - Co-Owner
   - Managing Partner
   - Principal
   - COO
   - Chairman

   **MID-LEVEL CONTACTS:**
   - VP of Finance
   - General Manager
   - Other VP-level positions

   **GENERIC EMAILS:**
   - Any generic company emails (info@, contact@, sales@, etc.)

3. For each valid contact, return:
   - first_name: Only the first name, with proper capitalization. (Use empty string "" for generic emails)
   - last_name: Only the last name, with proper capitalization. (Use empty string "" for generic emails)
   - title: Exact job title as written (e.g., "President and Chief Executive Officer", "VP of Finance", or "Generic Email").
   - linkedin_url: Must be a valid LinkedIn profile URL (must include 'linkedin.com/in/'). The link should not be related to a company or be the link to a post (linkedin.com/company or linkedin.com/posts). If not found, leave as empty string "". This should only contain linkedin.com URLs and no other URLs.
   - generic_email: The generic email address if applicable, otherwise empty string "".
   - source_url: The source URL you used to identify and reach this conclusion.
   - company_phone: The company phone number from the search results (if found, otherwise empty string "").

4. If the same person (same first and last name) appears more than once with different titles, only include them once in the final output.
   - Keep the most specific or complete title (e.g., "Founder and CEO" over just "CEO").
   - If titles are similar, choose the longer one or the one that combines multiple roles.
   - Make sure the first name and last name are unique and don't appear more than once.

5. For generic emails:
   - If multiple records reference the same source URL, select only one entry.
   - Ensure each email address appears only once in the final output.
   - Do not include hidden/obfuscated emails (e.g., infod********e@abc.com).

6. Ignore irrelevant results:
   - Do not include people with titles like Engineer, Recruiter, Technician, or HR.
   - Do not include placeholders like "Contact 2" or "Contact 3".
   - Do not include middle names or initials.

7. Do not hallucinate data. Only extract what is present in the text.

8. For company phone numbers, include the same company phone for all contacts from that company.

---

INPUT FORMAT:
You will be given a text summary of different search results that would contain the search query, the title, the link and the snippet of text and they will be separated by these characters: "\\n---\\n". here's an example:

[
**Search Query:** maagsoft.com \\"MaagSoft\\" CEO -zoominfo -dnb\\n\\n\\n\\n- Who We Are - Maagsoft\\n  https://maagsoft.com/who-we-are/\\n  We are Maagsoft, your catalysts for innovation, driving transformative solutions through cutting-edge technology and unparalleled expertise.\\n---\\n- Maagsoft\\n  https://maagsoft.com/\\n  CEO Fraud Alert: A Growing Threat. September 6, 2024. Read article · Uncategorized ... © MaagSoft. All Rights Reserved. Privacy Poliicy · Terms & conditions.\\n---\\n- CEO Fraud Alert: A Growing Threat - Maagsoft\\n  https://maagsoft.com/ceo-fraud-alert-a-growing-threat/\\n  CEO fraud, also known as a "spoofing" attack, is a type of social engineering scam where an attacker impersonates a high-level executive, typically the CEO.\\n---\\n- What We Do – Maagsoft\\n  https://maagsoft.com/what-we-do/\\n  Elevate your business with our suite of transformative services. From cybersecurity fortresses to data engineering marvels and AI-powered innovations, ...\\n\\n\\n**Search Query:** maagsoft.com \\"MaagSoft\\" Founder owner -zoominfo......
]

---

OUTPUT FORMAT:
Return ONLY a JSON array of the identified contacts. Each contact must follow this format:

[
  {
    "first_name": "Wes",
    "last_name": "Dorman",
    "title": "President and Chief Executive Officer",
    "linkedin_url": "",
    "generic_email": "",
    "source_url": "",
    "company_phone": "(614) 316-2342"
  },
  {
    "first_name": "Clint",
    "last_name": "Dorman",
    "title": "VP of Finance",
    "linkedin_url": "https://www.linkedin.com/in/clint-dorman-a157388b",
    "generic_email": "",
    "source_url": "",
    "company_phone": "(614) 316-2342"
  },
  {
    "first_name": "",
    "last_name": "",
    "title": "Generic Email",
    "linkedin_url": "",
    "generic_email": "info@example.com",
    "source_url": "https://www.example.com/",
    "company_phone": "(614) 316-2342"
  }
]

If no contacts are found, return an empty array: []

DO NOT return any explanation or extra text — ONLY the JSON array.
"""

    async def search_serper(self, session: aiohttp.ClientSession, query: str) -> Dict[str, Any]:
        """Make a single Serper API call"""
        headers = {
            "X-API-KEY": SERPER_API_KEY,
            "Content-Type": "application/json"
        }
        payload = {
            "q": query,
            "gl": "us",
            "autocorrect": False,
            "num": 10
        }

        try:
            async with session.post(self.serper_url, headers=headers, json=payload) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    print(f"Serper API error: {response.status} for query: {query}")
                    return {"organic": [], "searchParameters": {"q": query}}
        except Exception as e:
            print(f"Error calling Serper API: {e}")
            return {"organic": [], "searchParameters": {"q": query}}

    @staticmethod
    def _validate_linkedin_url(url) -> str:
        """Return the URL only if it is a valid LinkedIn personal profile URL, else empty string."""
        if not url or not isinstance(url, str):
            return ""
        url = url.strip()

        # Must be a LinkedIn URL and specifically a personal profile (/in/ path)
        if "linkedin.com/in/" not in url:
            return ""

        # Reject anything that slipped through with disallowed path segments
        disallowed = ("linkedin.com/company/", "linkedin.com/posts/", "linkedin.com/pub/dir/",
                      "linkedin.com/feed/", "linkedin.com/jobs/", "linkedin.com/school/")
        if any(d in url for d in disallowed):
            return ""

        return url

    async def process_company(self, session: aiohttp.ClientSession, domain: str, company_name: str) -> List[Dict]:
        """Process a single company - make all search queries in parallel"""
        print(f"Processing: {company_name} ({domain})")

        # Generate all search queries
        queries = [q.format(domain=domain, company_name=company_name) for q in self.search_queries]

        # Make all API calls in parallel
        tasks = [self.search_serper(session, query) for query in queries]
        results = await asyncio.gather(*tasks)

        # Format the results for LLM
        summary = self.format_search_results(results)

        # Single combined extraction call for all contacts
        all_contacts = await self.extract_all_contacts(session, summary)

        # Add domain and company name to each result; enforce LinkedIn URL validity
        for contact in all_contacts:
            contact['domain'] = domain
            contact['company_name'] = company_name
            contact['linkedin_url'] = self._validate_linkedin_url(contact.get('linkedin_url', ''))
            # Ensure generic_email field exists
            if 'generic_email' not in contact:
                contact['generic_email'] = ""

        return all_contacts

    def format_search_results(self, results: List[Dict]) -> str:
        """Format search results similar to the n8n Code node"""
        summary_sections = []
        result_separator = '\n---\n'

        for idx, result in enumerate(results):
            query = result.get('searchParameters', {}).get('q', '(No query found)')
            organic_results = result.get('organic', [])

            formatted_results = []
            for item in organic_results[:4]:  # Take first 4 results
                if 'title' in item and 'link' in item and 'snippet' in item:
                    formatted_results.append(
                        f"- {item['title']}\n  {item['link']}\n  {item['snippet']}"
                    )

            section = f"**Search Query:** {query}\n\n" + result_separator.join(formatted_results)
            summary_sections.append(section)

        return '\n\n\n'.join(summary_sections)

    async def extract_all_contacts(self, session: aiohttp.ClientSession, summary: str) -> List[Dict]:
        """Send formatted results to OpenRouter LLM for extraction of all contacts (decision makers, mid-level, and generic emails)"""
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "openai/gpt-4o-mini",
            "messages": [
                {
                    "role": "system",
                    "content": self.llm_combined_prompt
                },
                {
                    "role": "user",
                    "content": f"Here's the output of the google search results:\n{summary}"
                }
            ],
            "temperature": 0.1,
            "max_tokens": 4000
        }

        try:
            async with session.post(self.openrouter_url, headers=headers, json=payload) as response:
                if response.status == 200:
                    data = await response.json()
                    content = data['choices'][0]['message']['content']
                    # Try to parse JSON from the response
                    try:
                        # Remove markdown code blocks if present
                        if '```json' in content:
                            content = content.split('```json')[1].split('```')[0].strip()
                        elif '```' in content:
                            content = content.split('```')[1].split('```')[0].strip()
                        contacts = json.loads(content)
                        return contacts if isinstance(contacts, list) else []
                    except json.JSONDecodeError as e:
                        print(f"Error parsing LLM response as JSON: {e}")
                        print(f"Response content: {content[:200]}...")
                        return []
                else:
                    print(f"OpenRouter API error: {response.status}")
                    error_text = await response.text()
                    print(f"Error details: {error_text}")
                    return []
        except Exception as e:
            print(f"Error calling OpenRouter API: {e}")
            return []

    async def process_batch(self, companies: List[Dict]) -> List[Dict]:
        """Process a batch of companies"""
        async with aiohttp.ClientSession() as session:
            tasks = [
                self.process_company(session, company['Domain'], company['Company Name'])
                for company in companies
            ]
            results = await asyncio.gather(*tasks)

            # Flatten results
            all_decision_makers = []
            for decision_makers in results:
                all_decision_makers.extend(decision_makers)

            return all_decision_makers

    def read_input_file(self, file_path: str) -> pd.DataFrame:
        """Read input from Excel file"""
        if file_path.endswith('.xlsx') or file_path.endswith('.xls'):
            df = pd.read_excel(file_path)
        elif file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            raise ValueError("Unsupported file format. Use .xlsx, .xls, or .csv")

        # Validate required columns
        if 'Domain' not in df.columns or 'Company Name' not in df.columns:
            raise ValueError("Input file must contain 'Domain' and 'Company Name' columns")

        return df

    def extract_spreadsheet_info(self, sheet_url: str) -> tuple:
        """Extract spreadsheet ID and GID from Google Sheets URL"""
        # Extract spreadsheet ID
        match = re.search(r'/d/([a-zA-Z0-9-_]+)', sheet_url)
        if not match:
            raise ValueError("Invalid Google Sheets URL")
        spreadsheet_id = match.group(1)

        # Extract GID (sheet ID)
        gid = '0'  # Default to first sheet
        gid_match = re.search(r'[#&]gid=(\d+)', sheet_url)
        if gid_match:
            gid = gid_match.group(1)

        return spreadsheet_id, gid

    def get_sheet_title(self, sheet_url: str) -> str:
        """Get the title of the Google Sheet"""
        try:
            spreadsheet_id, _ = self.extract_spreadsheet_info(sheet_url)

            import requests
            response = requests.get(f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit")
            if response.status_code == 200:
                title_match = re.search(r'<title>([^<]+)</title>', response.text)
                if title_match:
                    title = title_match.group(1)
                    title = title.replace(' - Google Sheets', '').strip()
                    return title
        except Exception as e:
            print(f"Could not extract sheet title: {e}")

        return "output"  # Default fallback

    def read_public_google_sheet(self, sheet_url: str) -> pd.DataFrame:
        """Read input from a public Google Sheet URL"""
        try:
            spreadsheet_id, gid = self.extract_spreadsheet_info(sheet_url)

            # Construct CSV export URL for public sheets
            csv_url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=csv&gid={gid}"

            # Read directly using pandas
            df = pd.read_csv(csv_url)

            if 'Domain' not in df.columns or 'Company Name' not in df.columns:
                raise ValueError("Google Sheet must contain 'Domain' and 'Company Name' columns")

            return df
        except Exception as e:
            print(f"Error reading public Google Sheet: {e}")
            print("Trying authenticated access...")
            return self.read_google_sheet_authenticated(sheet_url)

    def read_google_sheet_authenticated(self, sheet_url: str) -> pd.DataFrame:
        """Read input from Google Sheet URL using service account authentication"""
        try:
            gc = gspread.service_account()
            sheet = gc.open_by_url(sheet_url)
            worksheet = sheet.get_worksheet(0)
            data = worksheet.get_all_records()
            df = pd.DataFrame(data)

            if 'Domain' not in df.columns or 'Company Name' not in df.columns:
                raise ValueError("Google Sheet must contain 'Domain' and 'Company Name' columns")

            return df
        except DefaultCredentialsError:
            print("Error: Google Sheets authentication not configured.")
            print("Please follow these steps:")
            print("1. Go to https://console.cloud.google.com/")
            print("2. Create a service account and download credentials JSON")
            print("3. Share your Google Sheet with the service account email")
            print("4. Save credentials as 'service_account.json' in the project directory")
            sys.exit(1)

    async def run(self, input_source: str, output_file: str = None):
        """Main execution function"""
        print("Decision Makers Finder - Starting...")

        # Read input
        if input_source.startswith('http'):
            print(f"Reading from Google Sheet: {input_source}")
            df = self.read_public_google_sheet(input_source)

            # Get sheet title and use it for output filename if not specified
            if output_file is None:
                sheet_title = self.get_sheet_title(input_source)
                # Sanitize filename
                safe_title = re.sub(r'[^\w\s-]', '', sheet_title).strip().replace(' ', '_')
                output_file = f"{safe_title}.csv"
                print(f"Output will be saved as: {output_file}")
        else:
            print(f"Reading from file: {input_source}")
            df = self.read_input_file(input_source)
            if output_file is None:
                output_file = "output.csv"

        print(f"Found {len(df)} companies to process")

        # Process in batches
        all_results = []
        for i in range(0, len(df), self.batch_size):
            batch = df.iloc[i:i + self.batch_size].to_dict('records')
            batch_num = i // self.batch_size + 1
            total_batches = (len(df) + self.batch_size - 1) // self.batch_size

            print(f"\nProcessing batch {batch_num}/{total_batches}...")

            results = await self.process_batch(batch)
            all_results.extend(results)

            print(f"Batch {batch_num} complete. Found {len(results)} contacts.")

        # Save results
        if all_results:
            results_df = pd.DataFrame(all_results)

            # Reorder columns for better readability
            column_order = ['first_name', 'last_name', 'title', 'linkedin_url', 'generic_email',
                          'source_url', 'company_phone', 'domain', 'company_name']
            # Only include columns that exist
            existing_columns = [col for col in column_order if col in results_df.columns]
            results_df = results_df[existing_columns]

            results_df.to_csv(output_file, index=False)
            print(f"\nResults saved to {output_file}")
            print(f"Total contacts found: {len(all_results)}")
        else:
            print("\nNo contacts found")

        return all_results


def main():
    if len(sys.argv) < 2:
        print("Usage: python decision_makers_finder.py <input_file_or_url> [output_file]")
        print("\nExamples:")
        print("  python decision_makers_finder.py input.xlsx")
        print("  python decision_makers_finder.py input.csv output.csv")
        print("  python decision_makers_finder.py https://docs.google.com/spreadsheets/d/...")
        print("  python decision_makers_finder.py https://docs.google.com/spreadsheets/d/... custom_output.csv")
        sys.exit(1)

    input_source = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None

    finder = DecisionMakersFinder()
    asyncio.run(finder.run(input_source, output_file))


if __name__ == "__main__":
    main()
