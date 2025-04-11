import requests
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get API URL from environment or use default
API_URL = os.getenv('API_URL', 'http://localhost:5000/api')

def test_health_check():
    """Test the health check endpoint."""
    print("Testing health check endpoint...")
    try:
        response = requests.get(f"{API_URL}/health")
        if response.status_code == 200:
            print("✅ Health check successful!")
            print(f"Response: {response.json()}")
            return True
        else:
            print(f"❌ Health check failed with status code: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check failed with error: {str(e)}")
        return False

def test_text_query():
    """Test the text query endpoint."""
    print("\nTesting text query endpoint...")
    try:
        data = {
            "text": "What are the symptoms of STIs?",
            "target_language": "en"
        }
        response = requests.post(f"{API_URL}/query", json=data)
        if response.status_code == 200:
            print("✅ Text query successful!")
            print(f"Response: {json.dumps(response.json(), indent=2)}")
            return True
        else:
            print(f"❌ Text query failed with status code: {response.status_code}")
            print(f"Error: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Text query failed with error: {str(e)}")
        return False

def test_translation():
    """Test the translation endpoint."""
    print("\nTesting translation endpoint...")
    try:
        data = {
            "text": "What are the symptoms of STIs?",
            "target_language": "sw"
        }
        response = requests.post(f"{API_URL}/translate", json=data)
        if response.status_code == 200:
            print("✅ Translation successful!")
            print(f"Response: {json.dumps(response.json(), indent=2)}")
            return True
        else:
            print(f"❌ Translation failed with status code: {response.status_code}")
            print(f"Error: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Translation failed with error: {str(e)}")
        return False

def main():
    """Run all tests."""
    print("=== HealthFirst Backend Tests ===")
    print(f"API URL: {API_URL}")
    
    # Run tests
    health_check_result = test_health_check()
    text_query_result = test_text_query()
    translation_result = test_translation()
    
    # Print summary
    print("\n=== Test Summary ===")
    print(f"Health Check: {'✅ Passed' if health_check_result else '❌ Failed'}")
    print(f"Text Query: {'✅ Passed' if text_query_result else '❌ Failed'}")
    print(f"Translation: {'✅ Passed' if translation_result else '❌ Failed'}")
    
    # Overall result
    if health_check_result and text_query_result and translation_result:
        print("\n✅ All tests passed!")
    else:
        print("\n❌ Some tests failed. Please check the errors above.")

if __name__ == "__main__":
    main() 