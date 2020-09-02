import { Accessory, Light, LightOperation } from "node-tradfri-client";
import { TradfriManager } from "./TradfriManager";

type TradfriLightIdentificationData = {
    deviceId: number
    name: string
    spectrum: string
}

export class TradfriLight {
    /**
     * Reference to the TradfriManager
     * @private
     */
    private manager: TradfriManager

    /**
     * Internal Accessory object of this Light
     * @private
     */
    private accessory: Accessory

    /**
     * Reference of the Light component of this Accessory
     * @private
     */
    private light: Light

    /**
     * Creates a TradfriLight from a given TradfriManager and Accessory
     *
     * @remarks The Accessory needs to be controller and observed
     * by the supplied TradfriManager
     *
     * @param manager (TradfriManager)
     * @param accessory (Accessory) that has a Light component
     */
    constructor(manager: TradfriManager, accessory: Accessory) {
        this.manager = manager
        this.accessory = accessory
        this.light = this.accessory.lightList[0]
    }

    /**
     * Returns the device id of this light.
     *
     * @remarks Needs further testing to ensure that this id doesn't change
     * between Gateway reconnects or restarts.
     *
     * @returns deviceId (number)
     */
    getDeviceId(): number {
        return this.accessory.instanceId
    }

    /**
     * Returns the Accessory object of this TradfriLight.
     *
     * @returns Accessory
     */
    getAccessoryObject(): Accessory {
        return this.accessory
    }

    /**
     * Returns the Light object of this TradfriLight.
     *
     * @returns Light
     */
    getLightObject(): Light {
        return this.light
    }

    /**
     * Returns some data about this device.
     *
     * @remarks See TradfriLightIdentificationData for details about the data returned.
     *
     * @returns - (TradfriLightIdentificationData)
     */
    getDeviceData(): TradfriLightIdentificationData {
        return {
            deviceId: this.accessory.instanceId,
            name: this.accessory.name,
            spectrum: this.light.spectrum
        }
    }

    /**
     * Runs a sequence of changes to the light
     * meant for the user to identify
     * the current lightbulb.
     */
    async identify() {
        const operations: LightOperation[] = [
            { onOff: true, color: "FF0000", dimmer: 100 },
            { onOff: false },
            { onOff: true },
            { onOff: false },
            { onOff: true },
            { onOff: false }
        ]

        await this.manager.executeOperations(this, operations, 1000, true)
    }

    /**
     * Toggles the light on or off.
     */
    async toggle() {
        await this.light.toggle()
    }

    /**
     * Sets the light's brightness value.
     *
     * @param value (number / 0-100) - Target Brightness value
     */
    async setBrightness(value: number) {
        await this.light.setBrightness(value)
    }

    /**
     * Sets the light's color value.
     *
     * @param value (string / 6-digit HEX color value) - Target Color value
     */
    async setColor(value: string) {
        await this.light.setColor(value)
    }
}