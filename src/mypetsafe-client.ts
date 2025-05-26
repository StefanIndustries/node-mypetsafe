import axios, { AxiosInstance, AxiosResponse } from "axios";
import {
    ChallengeNameType,
    CognitoIdentityProviderClient,
    InitiateAuthCommand,
    RespondToAuthChallengeCommand
} from "@aws-sdk/client-cognito-identity-provider";
import {DeviceScoopfree, DeviceSmartFeed} from "./devices";

export class PetSafeClient {
    private idToken?: string;
    private refreshToken?: string;
    private accessToken?: string;
    private readonly email: string;
    private session?: string;
    private username?: string;
    private tokenExpiresTime: number = 0;
    private challengeName?: ChallengeNameType;
    private readonly ax: AxiosInstance;
    private cognitoClient?: CognitoIdentityProviderClient;

    private readonly PETSAFE_API_BASE = 'https://platform.cloud.petsafe.net';
    private readonly PETSAFE_CLIENT_ID = '18hpp04puqmgf5nc6o474lcp2g';
    private readonly PETSAFE_REGION = 'us-east-1';

    constructor(
        email: string,
        idToken?: string,
        refreshToken?: string,
        accessToken?: string,
        session?: string,
    ) {
        this.email = email;
        this.idToken = idToken;
        this.refreshToken = refreshToken;
        this.accessToken = accessToken;
        this.session = session;

        this.ax = axios.create({
            baseURL: this.PETSAFE_API_BASE
        });
    }

    async getFeeders(): Promise<DeviceSmartFeed[]> {
        const response = await this.apiGet("smart-feed/feeders");
        return response.data.map((feederData: any) => new DeviceSmartFeed(this, feederData));
    }

    async getLitterboxes(): Promise<DeviceScoopfree[]> {
        const response = await this.apiGet("scoopfree/product/product");
        return response.data.data.map((litterboxData: any) => new DeviceScoopfree(this, litterboxData));
    }

    async requestCode(): Promise<void> {
        await this.getCognitoClient();

        try {
            const command = new InitiateAuthCommand({
                AuthFlow: "CUSTOM_AUTH",
                ClientId: this.PETSAFE_CLIENT_ID,
                AuthParameters: {
                    USERNAME: this.email,
                    AuthFlow: "CUSTOM_CHALLENGE"
                }
            });

            const response = await this.cognitoClient?.send(command);

            if (response) {
                this.challengeName = response.ChallengeName;
                this.session = response.Session;
                this.username = response.ChallengeParameters?.USERNAME;
            }
        } catch (error) {
            throw new InvalidUserException();
        }
    }

    async requestTokensFromCode(code: string): Promise<void> {
        if (!this.challengeName || !this.session || !this.username) {
            throw new Error("Must request code first");
        }

        const command = new RespondToAuthChallengeCommand({
            ClientId: this.PETSAFE_CLIENT_ID,
            ChallengeName: this.challengeName,
            Session: this.session,
            ChallengeResponses: {
                ANSWER: code.replace(/\D/g, ""),
                USERNAME: this.username
            }
        });

        const response = await this.cognitoClient?.send(command);

        if (!response?.AuthenticationResult) {
            throw new InvalidCodeException("Invalid confirmation code");
        }

        this.idToken = response.AuthenticationResult.IdToken;
        this.accessToken = response.AuthenticationResult.AccessToken;
        this.refreshToken = response.AuthenticationResult.RefreshToken;
        this.tokenExpiresTime = Date.now() + (response.AuthenticationResult.ExpiresIn || 0) * 1000;
    }

    private async refreshTokens(): Promise<void> {
        if (!this.refreshToken) {
            throw new Error("No refresh token available");
        }

        const command = new InitiateAuthCommand({
            AuthFlow: "REFRESH_TOKEN_AUTH",
            ClientId: this.PETSAFE_CLIENT_ID,
            AuthParameters: {
                REFRESH_TOKEN: this.refreshToken
            }
        });

        const response = await this.cognitoClient?.send(command);

        if (!response?.AuthenticationResult) {
            throw new Error("Failed to refresh tokens");
        }

        this.idToken = response.AuthenticationResult.IdToken;
        this.accessToken = response.AuthenticationResult.AccessToken;
        if (response.AuthenticationResult.RefreshToken) {
            this.refreshToken = response.AuthenticationResult.RefreshToken;
        }
        this.tokenExpiresTime = Date.now() + (response.AuthenticationResult.ExpiresIn || 0) * 1000;
    }

    private async getCognitoClient(): Promise<void> {
        if (!this.cognitoClient) {
            this.cognitoClient = new CognitoIdentityProviderClient({
                region: this.PETSAFE_REGION,
                credentials: () => Promise.resolve({
                    accessKeyId: "",
                    secretAccessKey: ""
                })
            });
        }
    }

    private async getHeaders(): Promise<Record<string, string>> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        if (!this.idToken) {
            throw new Error("Not authorized! Have you requested a token?");
        }

        if (Date.now() >= this.tokenExpiresTime - 100000) {
            await this.refreshTokens();
        }

        headers['Authorization'] = this.idToken;
        return headers;
    }

    async apiPost(path: string, data?: any): Promise<AxiosResponse> {
        const headers = await this.getHeaders();
        try {
            return await this.ax.post(path, data, { headers });
        } catch (error: any) {
            if (error?.response?.status === 403) {
                await this.refreshTokens();
                return await this.ax.post(path, data, { headers: await this.getHeaders() });
            }
            throw error;
        }
    }

    async apiGet(path: string): Promise<AxiosResponse> {
        const headers = await this.getHeaders();
        try {
            return await this.ax.get(path, { headers });
        } catch (error: any) {
            if (error?.response?.status === 403) {
                await this.refreshTokens();
                return await this.ax.get(path, { headers: await this.getHeaders() });
            }
            throw error;
        }
    }

    async apiPut(path: string, data?: any): Promise<AxiosResponse> {
        const headers = await this.getHeaders();
        try {
            return await this.ax.put(path, data, { headers });
        } catch (error: any) {
            if (error?.response?.status === 403) {
                await this.refreshTokens();
                return await this.ax.put(path, data, { headers: await this.getHeaders() });
            }
            throw error;
        }
    }

    async apiPatch(path: string, data?: any): Promise<AxiosResponse> {
        const headers = await this.getHeaders();
        try {
            return await this.ax.patch(path, data, { headers });
        } catch (error: any) {
            if (error?.response?.status === 403) {
                await this.refreshTokens();
                return await this.ax.patch(path, data, { headers: await this.getHeaders() });
            }
            throw error;
        }
    }

    async apiDelete(path: string): Promise<AxiosResponse> {
        const headers = await this.getHeaders();
        try {
            return await this.ax.delete(path, { headers });
        } catch (error: any) {
            if (error?.response?.status === 403) {
                await this.refreshTokens();
                return await this.ax.delete(path, { headers: await this.getHeaders() });
            }
            throw error;
        }
    }

    // Getters
    get getIdToken(): string | undefined {
        return this.idToken;
    }

    get getAccessToken(): string | undefined {
        return this.accessToken;
    }

    get getRefreshToken(): string | undefined {
        return this.refreshToken;
    }

    get getSession(): string | undefined {
        return this.session;
    }
}

export class InvalidCodeException extends Error {
    constructor(message?: string) {
        super(message);
        this.name = "InvalidCodeException";
    }
}

export class InvalidUserException extends Error {
    constructor(message?: string) {
        super(message);
        this.name = "InvalidUserException";
    }
}