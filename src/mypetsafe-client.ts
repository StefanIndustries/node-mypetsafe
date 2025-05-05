import axios, {AxiosInstance} from "axios";

export class MyPetSafeClient {
    private readonly email: string;
    private accessToken?: string;
    private refreshToken?: string;
    private expiresAt?: Date;
    private session?: string;

    private readonly ax: AxiosInstance;
    private abortController = new AbortController();

    private readonly petsafeApiUrl = `https://platform.cloud.petsafe.net/smart-feed/`;
    private readonly petsafeClientId = `18hpp04puqmgf5nc6o474lcp2g`;
    private readonly petsafeRegion = `us-east-1`;

    constructor(email: string, accessToken?: string, refreshToken?: string, expiresAt?: Date, session?: string) {
        this.email = email;
        if (accessToken && refreshToken && expiresAt && session) {
            this.accessToken = accessToken;
            this.refreshToken = refreshToken;
            this.expiresAt = expiresAt;
            this.session = session;
        }

        this.ax = axios.create({
            baseURL: this.petsafeApiUrl,
            signal: this.abortController.signal
        });
    }

    public async requestToken() {

    }
}