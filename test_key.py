import google.generativeai as genai

# Paste your new key directly here just for this test
genai.configure(api_key="Enter Your API key here") 

try:
    print("Fetching models...")
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"Found: {m.name}")
            
    print("\nTesting generation...")
    model = genai.GenerativeModel('gemini-2.5-flash')
    response = model.generate_content("Reply with the word 'Success'")
    print(f"AI Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
