import {
    AccessoryConfig,
    AccessoryPlugin,
    API, APIEvent,
    CharacteristicEventTypes,
    CharacteristicGetCallback,
    CharacteristicSetCallback,
    CharacteristicValue,
    HAP,
    Logging,
    Service,
} from 'homebridge';
import fetch from 'node-fetch';
import {LoginResponse} from './interfaces/loginResponse';
import {HubResponse} from './interfaces/hubResponse';
import {LocalStorage} from 'node-localstorage' ;

let hap: HAP;

export = (api: API) => {
    hap = api.hap;
    api.registerAccessory('homebridge-rituals-genie', 'Homebridge Rituals Genie', RitualsGenie);
};

class RitualsGenie implements AccessoryPlugin {

    private readonly API_BASE_URL = 'https://rituals.sense-company.com';

    private readonly log: Logging;
    private readonly name: string;
    private readonly email: string;
    private readonly password: string;
    private readonly storage: LocalStorage;
    private switchOn = false;

    private services: Service[] = [];
    private switchService?: Service;
    private informationService?: Service;
    private accountHash?: string;
    private hubHash?: string;

    constructor(log: Logging, config: AccessoryConfig, api: API) {
        this.log = log;
        this.name = config.name;
        this.email = config.email;
        this.password = config.password;

        this.storage = new LocalStorage('./rituals_storage');

        api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
            this.log.info('Finished launching homebridge');
            this.startConfiguring().then(() => this.log.info('Finished configuring')).catch(e => this.log.error(e));
        });
    }

    private async startConfiguring() {

        try {
            const accountHash = this.storage.getItem<string>('rituals_account_hash');
            if (accountHash == null || accountHash === '') {
                this.log('Logging in');
                await this.login();
            } else {
                this.log('Account hash restored from storage');
                this.accountHash = accountHash;
            }

            const hubHash = this.storage.getItem<string>('rituals_hub_hash');
            if (hubHash == null || hubHash === '') {
                this.log('Getting hub hash');
                await this.getHub();
            } else {
                this.log('Hub hash restored from storage');
                this.hubHash = hubHash;
            }

            await this.getStateForHub();
            await this.configureServices();

        } catch (error) {
            const _error = error as Error;
            this.log.error('Configuring failed!');
            this.log.error(_error.message);
        }
    }

    public identify() {
        this.log('Identify!');
    }

    public getServices(): Service[] {
        return this.services;
    }

    private async configureServices() {
        this.switchService = new hap.Service.Switch(this.name);
        this.switchService.getCharacteristic(hap.Characteristic.On)
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                this.log.info('Current state of the switch was returned: ' + (this.switchOn ? 'ON' : 'OFF'));
                callback(undefined, this.switchOn);
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                this.switchOn = value as boolean;
                this.log.info('Switch state was set to: ' + (this.switchOn ? 'ON' : 'OFF'));
                callback();
            });

        this.informationService = new hap.Service.AccessoryInformation()
            .setCharacteristic(hap.Characteristic.Manufacturer, 'Custom Manufacturer')
            .setCharacteristic(hap.Characteristic.Model, 'Custom Model');

        this.log.info('Switch finished initializing!');
    }

    private async login() {

        const body = {
            email: this.email,
            password: this.password,
        };

        const formBody = Object.keys(body).map(key => encodeURIComponent(key) + '=' + encodeURIComponent(body[key])).join('&');

        try {

            const response = await fetch(`${this.API_BASE_URL}/ocapi/login`, {
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
                    this.log.debug('Logged in successfully!');
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

            const response = await fetch(`${this.API_BASE_URL}/api/account/hubs/${this.accountHash}`, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36',
                },
            });

            if (response.status === 200) {

                const hubsResponse: HubResponse[] = await response.json();

                if (hubsResponse != null && hubsResponse.length > 0) {
                    const hubResponse = hubsResponse[0];
                    this.log.debug('HubResponse found!');
                    this.log(hubResponse.hub.hash);
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
            const response = await fetch(`${this.API_BASE_URL}/api/account/hub/${this.hubHash}`, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36',
                },
            });

            if (response.status === 200) {

                const hubResponse: HubResponse = await response.json();

                if (hubResponse != null && hubResponse.hub != null) {
                    this.log.debug('HubResponse found!');
                    this.log(hubResponse.hub.hash);
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
}