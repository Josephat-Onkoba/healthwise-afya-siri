@echo off
echo Setting up HealthFirst backend...

echo Creating virtual environment...
python -m venv venv

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Upgrading pip...
python -m pip install --upgrade pip

echo Installing dependencies...
pip install -r requirements.txt

echo Creating .env file from example...
if not exist .env (
    copy .env.example .env
    echo Please edit the .env file with your API keys and configuration.
)

echo Setup complete! You can now run the application using run_flask.bat
pause 