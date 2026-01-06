# Murder At Midnight API Usage

Test the API using Postman or any HTTP client.

Base URL: `http://localhost:8000`

## Endpoints

### 1. Get all interviews
- **GET /interviews**
- No arguments
- Returns: List of interviews

### 2. Add or update an interview
- **POST /interview**
- Arguments (form-data):
  - `name` (string): Interview name
  - `file` (file): MP3 audio file
- Returns: Interview info and transcript

### 3. Analyze guilt level
- **POST /analyze**
- Arguments (form-data):
  - `name` (string): Interview name
- Returns: Guilt level for the interview

No authentication required.
