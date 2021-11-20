import {
    API,
    DynamicPlatformPlugin,
    Logger,
    PlatformAccessory,
    PlatformConfig,
    Service,
    Characteristic, APIEvent,
} from 'homebridge';

import {PLATFORM_NAME, PLUGIN_NAME, API_BASE_URL} from './settings';
import fetch from 'node-fetch';
import {LocalStorage} from 'node-localstorage';
import {LoginResponse} from './interfaces/loginResponse';
import {Hub, HubResponse} from './interfaces/hubResponse';
import {FanAccessory} from './FanAccessory';

export class RitualsGeniePlatform implements DynamicPlatformPlugin {
    public readonly Service: typeof Service = this.api.hap.Service;
    public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

    public readonly accessories: PlatformAccessory[] = [];

    private readonly name?: string;
    private readonly email: string;
    private readonly password: string;
    private readonly storage: LocalStorage;

    private accountHash?: string;
    private hubHash?: string;
    hub?: Hub;

    constructor(
        public readonly log: Logger,
        public readonly config: PlatformConfig,
        public readonly api: API,
    ) {
        this.name = this.config.name;
        this.email = this.config.email;
        this.password = this.config.password;
        this.storage = new LocalStorage('./rituals_storage');

        this.log.info('Finished initializing platform:', this.config.name);

        this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
            log.info('Executed didFinishLaunching callback');
            this.onDidFinishLaunching().then(() => this.log.info('Finished configuring')).catch(e => this.log.error(e));
        });
    }

    configureAccessory(accessory: PlatformAccessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName);
        this.accessories.push(accessory);
    }

    async onDidFinishLaunching() {

        try {
            const accountHash = this.storage.getItem<string>('rituals_account_hash');
            if (accountHash == null || accountHash === '') {
                this.log.info('Logging in');
                await this.login();
            } else {
                this.log.info('Account hash restored from storage');
                this.accountHash = accountHash;
            }

            const hubHash = this.storage.getItem<string>('rituals_hub_hash');
            if (hubHash == null || hubHash === '') {
                this.log.info('Getting hub hash');
                await this.getHub();
            } else {
                this.log.info('Hub hash restored from storage');
                this.hubHash = hubHash;
            }

            await this.getStateForHub();
            this.addFanAccessory();

        } catch (error) {
            const _error = error as Error;
            this.log.error('Configuring failed!');
            this.log.error(_error.message);
        }

    }

    addFanAccessory() {

        const uuid = this.api.hap.uuid.generate('fan');

        const existingFan = this.accessories.find(accessory => accessory.UUID === uuid);

        if (existingFan) {
            this.log.info('Restoring existing accessory from cache:', existingFan.displayName);
            new FanAccessory(this, existingFan);
        } else {
            this.log.info('Adding new accessory: Fan');

            const accessory = new this.api.platformAccessory('Fan', uuid);
            accessory.context.displayName = this.config.name;

            new FanAccessory(this, accessory);
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
    }

    private async login() {

        const body = {
            email: this.email,
            password: this.password,
        };

        const formBody = Object.keys(body).map(key => encodeURIComponent(key) + '=' + encodeURIComponent(body[key])).join('&');

        try {

            const response = await fetch(`${API_BASE_URL}/ocapi/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36',
                },
                body: formBody,
            });

            if (response.status === 200) {

                const loginResponse: LoginResponse = await response.json();

                if (loginResponse != null && loginResponse.account_hash != null) {
                    this.storage.setItem('rituals_account_hash', loginResponse.account_hash);
                    this.accountHash = loginResponse.account_hash;
                    this.log.info('Logged in successfully!');
                } else {
                    this.log.error('Login failed!');
                }

            } else {
                this.log.error('Login failed!');
            }

        } catch (error) {
            const _error = error as Error;
            this.log.error('Login Failed!');
            this.log.error(_error.message);
        }

    }

    private async getHub() {
        try {

            const response = await fetch(`${API_BASE_URL}/api/account/hubs/${this.accountHash}`, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36',
                },
            });

            if (response.status === 200) {

                const hubsResponse: HubResponse[] = await response.json();

                if (hubsResponse != null && hubsResponse.length > 0) {
                    const hubResponse = hubsResponse[0];
                    this.log.info('HubResponse found!');
                    this.storage.setItem('rituals_hub_hash', hubResponse.hub.hash);
                    this.hubHash = hubResponse.hub.hash;
                } else {
                    this.log.error('No hubs found!');
                }

            } else {
                this.log.error('No hubs found!');
            }

        } catch (error) {
            const _error = error as Error;
            this.log.error('Get HubResponse Failed!');
            this.log.error(_error.message);
        }
    }

    private async getStateForHub() {

        try {
            const response = await fetch(`${API_BASE_URL}/api/account/hub/${this.hubHash}`, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36',
                },
            });

            if (response.status === 200) {

                const hubResponse: HubResponse = await response.json();

                if (hubResponse != null && hubResponse.hub != null) {
                    this.log.info('HubResponse found!');
                    this.hub = hubResponse.hub;
                } else {
                    this.log.error('No hubs found! Response is null');
                }

            } else {
                this.log.error('No hubs found! Status is not 200');
            }
        } catch (error) {
            const _error = error as Error;
            this.log.error('Get State Failed!');
            this.log.error(_error.message);
        }
    }

    public async updateOnState(onState: boolean) {
        const body = {
            hub: this.hubHash,
            json: `{ "attr": { "fanc": "${onState ? 1 : 0}" } }`,
        };

        const formBody = Object.keys(body).map(key => encodeURIComponent(key) + '=' + encodeURIComponent(body[key])).join('&');
        await this.updateHub(formBody);
    }

    public async updateFanSpeed(speedValue: string) {
        const body = {
            hub: this.hubHash,
            json: `{ "attr": { "speedc": "${speedValue}" } }`,
        };

        const formBody = Object.keys(body).map(key => encodeURIComponent(key) + '=' + encodeURIComponent(body[key])).join('&');
        await this.updateHub(formBody);
    }

    private async updateHub(formBody: string) {
        try {

            const response = await fetch(`${API_BASE_URL}/api/hub/update/attr`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36',
                },
                body: formBody,
            });

            if (response.status === 200) {
                this.log.info('Updated hub successfully!');
                return this.getStateForHub();
            } else {
                this.log.error('Update hub failed!');
            }

        } catch (error) {
            const _error = error as Error;
            this.log.error('Update hub Failed!');
            this.log.error(_error.message);
        }
    }
}