# Windows Setup Guide for HealthFirst

This guide provides specific instructions for setting up the HealthFirst application on Windows.

## Prerequisites

1. **Python Installation**
   - Download and install Python 3.11 from [python.org](https://www.python.org/downloads/)
   - Make sure to check "Add Python to PATH" during installation
   - Verify installation by running `python --version` in Command Prompt

2. **Tesseract OCR Installation**
   - Download the Windows installer from [GitHub](https://github.com/UB-Mannheim/tesseract/wiki)
   - Install to a location like `C:\Program Files\Tesseract-OCR`
   - Add the installation directory to your PATH environment variable

3. **Node.js Installation**
   - Download and install Node.js from [nodejs.org](https://nodejs.org/)
   - Verify installation by running `node --version` in Command Prompt

## Backend Setup

1. **Using the Setup Script**
   ```bash
   # Navigate to the backend directory
   cd backend
   
   # Run the setup script
   setup.bat
   ```

2. **Manual Setup (if the script fails)**
   ```bash
   # Create virtual environment
   python -m venv venv
   
   # Activate virtual environment
   venv\Scripts\activate
   
   # Upgrade pip
   python -m pip install --upgrade pip
   
   # Install dependencies
   pip install -r requirements.txt
   
   # Create .env file
   copy .env.example .env
   ```

3. **Running the Backend**
   ```bash
   # Use the provided batch file
   run_flask.bat
   
   # Or manually
   venv\Scripts\activate
   set FLASK_APP=run.py
   set FLASK_ENV=development
   python -m flask run
   ```

## Frontend Setup

1. **Install Dependencies**
   ```bash
   # Navigate to the frontend directory
   cd frontend
   
   # Install dependencies
   npm install
   
   # Create .env.local file
   copy .env.example .env.local
   ```

2. **Running the Frontend**
   ```bash
   npm run dev
   ```

## Common Issues and Solutions

### 1. "flask is not recognized" Error

If you see this error when trying to run `flask run`:

```
flask : The term 'flask' is not recognized as the name of a cmdlet, function, script file, or operable program.
```

**Solution:**
- Use the provided `run_flask.bat` script
- Or run `python -m flask run` instead of just `flask run`
- Make sure your virtual environment is activated

### 2. ChromaDB Installation Issues

If you encounter errors installing ChromaDB:

**Solution:**
- Try installing a specific version: `pip install chromadb==0.3.29`
- Install build tools: `pip install wheel setuptools`
- If still having issues, try: `pip install --no-deps chromadb==0.3.29`

### 3. Tesseract OCR Issues

If you get errors related to Tesseract:

**Solution:**
- Make sure Tesseract is installed and in your PATH
- Add this to your `.env` file:
  ```
  TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
  ```

### 4. Python Path Issues

If Python commands aren't recognized:

**Solution:**
- Make sure Python is in your PATH
- Use the full path to Python: `C:\Path\To\Python\python.exe -m pip install -r requirements.txt`

## Additional Resources

- [Python on Windows](https://docs.python.org/3/using/windows.html)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [Next.js Documentation](https://nextjs.org/docs) 