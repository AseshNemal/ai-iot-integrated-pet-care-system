import axios from 'axios';

const hrApi = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8090',
  withCredentials: true
});

export default hrApi;
