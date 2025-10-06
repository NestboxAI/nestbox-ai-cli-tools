import axios from "axios";
import { setupAuthAndConfig, AuthResult } from "./api";
export async function userData() {
	try {
		const auth = await setupAuthAndConfig();
		const authData = auth?.authData;

		if (!authData || !authData.apiURL || !authData.token) {
			throw new Error(
				"No authentication data found. Please login first."
			);
		}

		const response = await axios.get(`${authData.apiURL}/user/me`, {
			headers: {
				Authorization: `${authData.token}`,
			},
		});

		return response.data;
	} catch (error: any) {
		console.error(
			"Error fetching user data:",
			error.message || "Unknown error"
		);
		if (error.response) {
		}
		throw error; // Rethrow to allow caller to handle the error
	}
}
