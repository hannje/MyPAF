import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

// 1. Create a new cookie jar
// By creating it here, it acts as a singleton. All imports of this
// module will share the SAME jar, which is what we want.
const jar = new CookieJar();

// 2. Create a new axios instance wrapped with cookie jar support
const apiClient = wrapper(axios.create({
  jar: jar,
  withCredentials: true, // This is still important
}));

// 3. Set your base URL
// Note: Ensure this points to your HTTPS backend for the emulator
apiClient.defaults.baseURL = process.env.REACT_APP_API_URL || 'https://10.72.14.19:3443';

export default apiClient;