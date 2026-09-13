import requests, os

CLIENT_ID = os.environ["CLIENT_ID"]
CLIENT_SECRET = os.environ["CLIENT_SECRET"]
AUTH_CODE = os.environ["AUTH_CODE"]

# Step 1: Exchange auth code for tokens
r1 = requests.post("https://api.prod.whoop.com/oauth/oauth2/token", data={
    "grant_type": "authorization_code",
    "code": AUTH_CODE,
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "redirect_uri": "https://localhost"
})
print("Step1 status:", r1.status_code)
if r1.status_code != 200:
    print("Step1 error body:", r1.text)
    exit(1)
body1 = r1.json()
refresh1 = body1["refresh_token"]
print("Step1 refresh_token (will be consumed by sync.py):", refresh1)
print("::notice::STEP1_REFRESH=" + refresh1)

# Step 2: Immediately use that refresh token once (simulating what sync.py will do)
# to get the SECOND rotation - this is what sync.py will actually see
r2 = requests.post("https://api.prod.whoop.com/oauth/oauth2/token", data={
    "grant_type": "refresh_token",
    "refresh_token": refresh1,
    "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET,
})
print("Step2 status:", r2.status_code)
if r2.status_code != 200:
    print("Step2 error body:", r2.text)
    print("::notice::FINAL_REFRESH=" + refresh1 + " (step2 failed, use step1)")
else:
    body2 = r2.json()
    refresh2 = body2["refresh_token"]
    print("Step2 refresh_token:", refresh2)
    print("::notice::FINAL_REFRESH=" + refresh2)
