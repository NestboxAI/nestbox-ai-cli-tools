import axios from "axios";
import { getAuthToken } from "./auth";

export async function userData() {
    try {
        const authData = getAuthToken();

        if (!authData || !authData.serverUrl || !authData.token) {
            throw new Error("No authentication data found. Please login first.");
        }
        
        const response = await axios.get(
            `${authData.serverUrl}/user/me`,
            {
                headers: {
                    Authorization: `${authData.token}`,
                },
            }
        );
        
        return response.data;
    } catch (error) {
        console.error("Error fetching user data:", error.message || "Unknown error");
        if (error.response) {
        }
        throw error; // Rethrow to allow caller to handle the error
    }
}