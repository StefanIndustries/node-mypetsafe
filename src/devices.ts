// devices.ts
import {PetSafeClient} from "./mypetsafe-client";

interface FeederData {
    thing_name: string;
    id: string;
    battery_voltage: string;
    is_batteries_installed: boolean;
    settings: {
        paused: boolean;
        slow_feed: boolean;
        child_lock: boolean;
        friendly_name: string;
        pet_type: string;
    };
    food_sensor_current: string;
    is_food_low: string;
    firmware_version: string;
    product_name: string;
}

interface LitterboxData {
    thingName: string;
    friendlyName: string;
    productName: string;
    shadow: {
        state: {
            reported: {
                firmware: string;
            }
        }
    }
}

export class DeviceSmartFeed {
    private client: PetSafeClient;
    private data: FeederData;

    constructor(client: PetSafeClient, data: FeederData) {
        this.client = client;
        this.data = data;
    }

    toJSON(): string {
        return JSON.stringify(this.data, null, 2);
    }

    async updateData(): Promise<void> {
        const response = await this.client.apiGet(this.apiPath);
        this.data = response.data;
    }

    async putSetting(setting: string, value: any, forceUpdate: boolean = false): Promise<void> {
        await this.client.apiPut(
            `${this.apiPath}settings/${setting}`,
            { value }
        );

        if (forceUpdate) {
            await this.updateData();
        } else {
            // @ts-ignore
            this.data.settings[setting] = value;
        }
    }

    async getMessagesSince(days: number = 7): Promise<any> {
        const response = await this.client.apiGet(
            `${this.apiPath}messages?days=${days}`
        );
        return response.data;
    }

    async getLastFeeding(): Promise<any | null> {
        const messages = await this.getMessagesSince();
        // @ts-ignore
        return messages.find(message => message.message_type === "FEED_DONE") || null;
    }

    async feed(amount: number = 1, slowFeed?: boolean, updateData: boolean = true): Promise<void> {
        slowFeed = slowFeed ?? this.data.settings.slow_feed;
        await this.client.apiPost(
            `${this.apiPath}meals`,
            { amount, slow_feed: slowFeed }
        );

        if (updateData) {
            await this.updateData();
        }
    }

    async repeatFeed(): Promise<void> {
        const lastFeeding = await this.getLastFeeding();
        if (lastFeeding) {
            await this.feed(lastFeeding.amount);
        }
    }

    async prime(): Promise<void> {
        await this.feed(5, false);
    }

    async getSchedules(): Promise<any> {
        const response = await this.client.apiGet(`${this.apiPath}schedules`);
        return response.data;
    }

    async scheduleFeed(time: string = "00:00", amount: number = 1, updateData: boolean = true): Promise<any> {
        const response = await this.client.apiPost(
            `${this.apiPath}schedules`,
            { time, amount }
        );

        if (updateData) {
            await this.updateData();
        }

        return response.data;
    }

    async modifySchedule(time: string = "00:00", amount: number = 1, scheduleId: string, updateData: boolean = true): Promise<void> {
        await this.client.apiPut(
            `${this.apiPath}schedules/${scheduleId}`,
            { time, amount }
        );

        if (updateData) {
            await this.updateData();
        }
    }

    async deleteSchedule(scheduleId: string, updateData: boolean = true): Promise<void> {
        await this.client.apiDelete(`${this.apiPath}schedules/${scheduleId}`);

        if (updateData) {
            await this.updateData();
        }
    }

    async deleteAllSchedules(updateData: boolean = true): Promise<void> {
        await this.client.apiDelete(`${this.apiPath}schedules`);

        if (updateData) {
            await this.updateData();
        }
    }

    async pauseSchedules(value: boolean, updateData: boolean = true): Promise<void> {
        await this.client.apiPut(
            `${this.apiPath}settings/paused`,
            { value }
        );

        if (updateData) {
            await this.updateData();
        }
    }

    async pause(value: boolean = true): Promise<void> {
        await this.putSetting("paused", value);
    }

    async lock(value: boolean = true): Promise<void> {
        await this.putSetting("child_lock", value);
    }

    async slowFeed(value: boolean = true): Promise<void> {
        await this.putSetting("slow_feed", value);
    }

    // Properties
    get apiName(): string {
        return this.data.thing_name;
    }

    get apiPath(): string {
        return `smart-feed/feeders/${this.apiName}/`;
    }

    get id(): string {
        return this.data.id;
    }

    get batteryVoltage(): number {
        try {
            return Number((parseInt(this.data.battery_voltage) / 32767 * 7.2).toFixed(3));
        } catch {
            return -1;
        }
    }

    get batteryLevel(): number {
        if (!this.data.is_batteries_installed) {
            return 0;
        }
        const minVoltage = 22755;
        const maxVoltage = 29100;
        return Math.round(
            Math.max(
                (100 * (parseInt(this.data.battery_voltage) - minVoltage))
                / (maxVoltage - minVoltage),
                0
            )
        );
    }

    get isPaused(): boolean {
        return this.data.settings.paused;
    }

    get isSlowFeed(): boolean {
        return this.data.settings.slow_feed;
    }

    get isLocked(): boolean {
        return this.data.settings.child_lock;
    }

    get friendlyName(): string {
        return this.data.settings.friendly_name;
    }

    get petType(): string {
        return this.data.settings.pet_type;
    }

    get foodSensorCurrent(): string {
        return this.data.food_sensor_current;
    }

    get foodLowStatus(): number {
        return parseInt(this.data.is_food_low);
    }

    get firmware(): string {
        return this.data.firmware_version;
    }

    get productName(): string {
        return this.data.product_name;
    }
}

export class DeviceScoopfree {
    private client: PetSafeClient;
    private data: LitterboxData;

    constructor(client: PetSafeClient, data: LitterboxData) {
        this.client = client;
        this.data = data;
    }

    toJSON(): string {
        return JSON.stringify(this.data, null, 2);
    }

    async updateData(): Promise<void> {
        const response = await this.client.apiGet(this.apiPath);
        this.data = response.data;
    }

    async rake(updateData: boolean = true): Promise<any> {
        const response = await this.client.apiPost(`${this.apiPath}rake-now`, {});

        if (updateData) {
            await this.updateData();
            return this.data;
        }
    }

    async reset(rakeCount: number = 0, updateData: boolean = true): Promise<any> {
        const response = await this.client.apiPatch(
            `${this.apiPath}shadow`,
            { rakeCount }
        );

        if (updateData) {
            await this.updateData();
            return this.data;
        }
    }

    async modifyTimer(rakeDelayTime: number = 15, updateData: boolean = true): Promise<any> {
        const response = await this.client.apiPatch(
            `${this.apiPath}shadow`,
            { rakeDelayTime }
        );

        if (updateData) {
            await this.updateData();
            return this.data;
        }
    }

    async getActivity(): Promise<any> {
        const response = await this.client.apiGet(`${this.apiPath}activity`);
        return response.data;
    }

    async patchSetting(setting: string, value: any, forceUpdate: boolean = false): Promise<void> {
        await this.client.apiPatch(
            `${this.apiPath}settings`,
            { [setting]: value }
        );

        if (forceUpdate) {
            await this.updateData();
        } else {
            // @ts-ignore
            this.data[setting] = value;
        }
    }

    // Properties
    get apiName(): string {
        return this.data.thingName;
    }

    get apiPath(): string {
        return `scoopfree/product/product/${this.apiName}/`;
    }

    get friendlyName(): string {
        return this.data.friendlyName;
    }

    get firmware(): string {
        return this.data.shadow.state.reported.firmware;
    }

    get productName(): string {
        return this.data.productName;
    }
}