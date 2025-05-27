import axios, { AxiosInstance, AxiosResponse } from "axios";
import {DeviceScoopfree, DeviceSmartFeed} from "./devices";
import {EventEmitter} from "node:events";

export class PetSafeClient {
    private idToken?: string;
    private refreshToken?: string;
    private accessToken?: string;
    private readonly email: string;
    private session?: string;
    private username?: string;
    private tokenExpiresTime: number = 0;
    private challengeName?: string;
    private readonly ax: AxiosInstance;

    private readonly PETSAFE_API_BASE = 'https://platform.cloud.petsafe.net';
    private readonly PETSAFE_CLIENT_ID = '18hpp04puqmgf5nc6o474lcp2g';
    private readonly PETSAFE_REGION = 'us-east-1';
    private readonly COGNITO_URL = `https://cognito-idp.${this.PETSAFE_REGION}.amazonaws.com/`;

    private eventEmitter: EventEmitter;

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

        this.eventEmitter = new EventEmitter();
    }

    onTokenRefreshed(listener: (tokens: { idToken: string; accessToken: string; refreshToken: string | undefined }) => void): void {
        this.eventEmitter.on("tokenRefreshed", listener);
    }

    private emitTokenRefreshed(): void {
        if (!this.idToken || !this.accessToken) return;

        this.eventEmitter.emit("tokenRefreshed", {
            idToken: this.idToken,
            accessToken: this.accessToken,
            refreshToken: this.refreshToken,
            session: this.session,
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

    async requestCode() {
        const response = await axios.post(
            this.COGNITO_URL,
            {
                AuthFlow: "CUSTOM_AUTH",
                ClientId: this.PETSAFE_CLIENT_ID,
                AuthParameters: {
                    USERNAME: this.email,
                    AuthFlow: "CUSTOM_CHALLENGE"
                },
            },
            {
                headers: {
                    "Content-Type": "application/x-amz-json-1.1",
                    "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
                },
            }
        );

        this.session = response.data.Session;
        this.challengeName = response.data.ChallengeName;
        this.username = response.data.ChallengeParameters?.USERNAME ?? this.email;
    }

    async requestTokensFromCode(code: string) {
        if (!this.challengeName || !this.session || !this.username) {
            throw new Error("Must request code first");
        }

        const response = await axios.post(
            this.COGNITO_URL,
            {
                ChallengeName: "CUSTOM_CHALLENGE",
                ClientId: this.PETSAFE_CLIENT_ID,
                Session: this.session,
                ChallengeResponses: {
                    USERNAME: this.email,
                    ANSWER: code.replace(/\D/g, ""),
                },
            },
            {
                headers: {
                    "Content-Type": "application/x-amz-json-1.1",
                    "X-Amz-Target": "AWSCognitoIdentityProviderService.RespondToAuthChallenge",
                },
            }
        );

        this.idToken = response.data.AuthenticationResult?.IdToken;
        this.accessToken = response.data.AuthenticationResult?.AccessToken;
        this.refreshToken = response.data.AuthenticationResult?.RefreshToken;
        this.tokenExpiresTime = Date.now() + response.data.AuthenticationResult?.ExpiresIn * 1000;
        this.emitTokenRefreshed();
    }

    async refreshTokens() {
        if (!this.refreshToken) {
            throw new Error("No refresh token available");
        }
        const response = await axios.post(
            this.COGNITO_URL,
            {
                AuthFlow: "REFRESH_TOKEN_AUTH",
                ClientId: this.PETSAFE_CLIENT_ID,
                AuthParameters: {
                    REFRESH_TOKEN: this.refreshToken,
                },
            },
            {
                headers: {
                    "Content-Type": "application/x-amz-json-1.1",
                    "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
                },
            }
        );

        if (response.data) {
            this.idToken = response.data.AuthenticationResult?.IdToken;
            this.accessToken = response.data.AuthenticationResult?.AccessToken;
            this.refreshToken = response.data.AuthenticationResult?.RefreshToken ?? this.refreshToken;
            this.tokenExpiresTime = Date.now() + response.data.AuthenticationResult?.ExpiresIn * 1000;
            this.emitTokenRefreshed();
        } else {
            throw new Error("Failed to refresh tokens");
        }
    }

    private async getHeaders(): Promise<Record<string, string>> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        if (!this.idToken) {
            throw new Error("Not authorized! Have you requested a token?");
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