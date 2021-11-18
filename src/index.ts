import {
    AccessoryConfig,
    AccessoryPlugin,
    API,
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

let hap: HAP;

export = (api: API) => {
    hap = api.hap;
    api.registerAccessory('homebridge-rituals-genie', 'Homebridge Rituals Genie', RitualsGenie);
};

class RitualsGenie implements AccessoryPlugin {

    private readonly log: Logging;
    private readonly name: string;
    private readonly email: string;
    private readonly password: string;
    private switchOn = false;

    private readonly switchService: Service;
    private readonly informationService: Service;

    private readonly API_BASE_URL = 'https://rituals.sense-company.com';

    private accountHash?: string;

    constructor(log: Logging, config: AccessoryConfig, api: API) {
        this.log = log;
        this.name = config.name;
        this.email = config.email;
        this.password = config.password;

        this.switchService = new hap.Service.Switch(this.name);
        this.switchService.getCharacteristic(hap.Characteristic.On)
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                log.info('Current state of the switch was returned: ' + (this.switchOn ? 'ON' : 'OFF'));
                callback(undefined, this.switchOn);
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                this.switchOn = value as boolean;
                log.info('Switch state was set to: ' + (this.switchOn ? 'ON' : 'OFF'));
                callback();
            });

        this.informationService = new hap.Service.AccessoryInformation()
            .setCharacteristic(hap.Characteristic.Manufacturer, 'Custom Manufacturer')
            .setCharacteristic(hap.Characteristic.Model, 'Custom Model');

        log.info('Switch finished initializing!');

        this.login();
    }

    identify = (): void => {
        this.log('Identify!');
    };

    getServices = (): Service[] => {
        return [
            this.informationService,
            this.switchService,
        ];
    };

    login = async (): Promise<void> => {

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
                    this.accountHash = loginResponse.account_hash;
                    this.log.debug('Logged in successfully!');

                    return this.getHub();
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

    };

    getHub = async (): Promise<void> => {
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
    };
}