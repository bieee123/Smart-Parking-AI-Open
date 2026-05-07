import axios from 'axios';

async function testProfile() {
  try {
    console.log("Attempting to login...");
    const loginRes = await axios.post('http://localhost:8000/api/auth/login', {
      username: 'admin',
      password: 'AdminPassword123'
    });

    const token = loginRes.data.data.token;
    console.log("Login successful, token received.");

    console.log("Fetching profile...");
    const profileRes = await axios.get('http://localhost:8000/api/profile', {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log("Profile response:", JSON.stringify(profileRes.data, null, 2));
  } catch (err) {
    console.error("Error during test:");
    if (err.response) {
      console.error(`Status: ${err.response.status}`);
      console.error("Data:", JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err.message);
    }
  }
}

testProfile();
