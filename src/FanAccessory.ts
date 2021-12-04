import {Service, PlatformAccessory, CharacteristicValue} from 'homebridge';

import {RitualsGeniePlatform} from './platform';

export class FanAccessory {

    private service: Service;

    constructor(
        private readonly platform: RitualsGeniePlatform,
        private readonly accessory: PlatformAccessory,
    ) {

        // set accessory information
        this.accessory.getService(this.platform.Service.AccessoryInformation)!
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Rituals')
            .setCharacteristic(this.platform.Characteristic.Model, 'Perfume Genie')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, this.platform.hub?.hublot ?? '')
            .setCharacteristic(this.platform.Characteristic.FirmwareRevision, this.platform.hub?.sensors?.versionc ?? '');

        // set filter maintenance
        // this.accessory.getService(this.platform.Service.FilterMaintenance)!
        //     .setCharacteristic(this.platform.Characteristic.FilterChangeIndication, this.platform.Characteristic.FilterChangeIndication.FILTER_OK)
        //     .setCharacteristic(this.platform.Characteristic.Name, this.platform.hub?.sensors?.rfidc?.title ?? '');

        this.service = this.accessory.getService(this.platform.Service.Fan) || this.accessory.addService(this.platform.Service.Fan);

        this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.displayName);
        this.service.getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.setOn.bind(this))
            .onGet(this.getOn.bind(this));

        this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
            .setProps({
                minValue: 0,
                maxValue: 100,
            })
            .onSet(this.setFanSpeed.bind(this))
            .onGet(this.getFanSpeed.bind(this));
    }

    async setOn(value: CharacteristicValue) {
        this.platform.log.info('Set Characteristic On ->', value);
        await this.platform.updateOnState(value as boolean);
    }

    async getOn(): Promise<CharacteristicValue> {
        await this.platform.getStateForHub();
        // if (this.platform.lastHubState && new Date().getTime() - this.platform.lastHubState.getTime() > 60000) {
        //     await this.platform.getStateForHub();
        // }
        const isOn = this.platform.hub?.attributes.fanc == '1' ?? false;
        this.platform.log.info('Get Characteristic On ->', isOn);
        return isOn;
    }

    async setFanSpeed(value: CharacteristicValue) {
        this.platform.log.info('Fan Speed Value Start ->', value);
        if (this.platform.hub?.attributes.fanc == '1') {
            let apiFanSpeed = this.platform.hub?.attributes.speedc ?? '1';
            if (value <= 33) {
                this.platform.log.info('Fan Speed value <= 33');
                apiFanSpeed = '1';
            } else if (value > 33 && value <= 67) {
                this.platform.log.info('Fan Speed value between 33 and 67');
                apiFanSpeed = '2';
            } else if (value > 67) {
                this.platform.log.info('Fan Speed value > 67');
                apiFanSpeed = '3';
            }
            this.platform.log.info('Fan Speed Value ->', value);
            this.platform.log.info('Set FanSpeed ->', apiFanSpeed);
            await this.platform.updateFanSpeed(apiFanSpeed);
        }
    }

    async getFanSpeed(): Promise<CharacteristicValue> {
        // If fan is off then return 0
        if (this.platform.hub?.attributes.fanc == '0') {
            return 0;
        } else {
            await this.platform.getStateForHub();
            // if (this.platform.lastHubState && new Date().getTime() - this.platform.lastHubState.getTime() > 60000) {
            //     await this.platform.getStateForHub();
            // }
            const apiFanSpeed = this.platform.hub?.attributes.speedc;
            let fanSpeed: number;
            switch (apiFanSpeed) {
                case '1':
                    fanSpeed = 100 / 3;
                    break;
                case '2':
                    fanSpeed = (100 / 3) * 2;
                    break;
                case '3':
                    fanSpeed = 100;
                    break;
                default:
                    fanSpeed = 0;
                    break;
            }
            this.platform.log.info('Get FanSpeed ->', fanSpeed);
            return fanSpeed;
        }
    }

}