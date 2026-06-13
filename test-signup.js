async function testSignupLogin() {
    const email = 'test' + Date.now() + '@example.com';
    const password = 'password123';
    
    try {
        console.log("Signing up...");
        const res = await fetch('http://localhost:5000/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'testuser' + Date.now(),
                email: email,
                password: password
            })
        });
        const data = await res.json();
        console.log("Signup res:", data);

        console.log("Logging in...");
        const loginRes = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });
        const loginData = await loginRes.json();
        console.log("Login res:", loginData);
    } catch (err) {
        console.error("Fetch failed:", err);
    }
}

testSignupLogin();
