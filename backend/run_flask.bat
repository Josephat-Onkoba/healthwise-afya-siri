@echo off
echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Setting Flask environment variables...
set FLASK_APP=run.py
set FLASK_ENV=development

echo Starting Flask server...
python -m flask run

pause 