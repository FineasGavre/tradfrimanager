import { Accessory, AccessoryTypes, LightOperation, TradfriClient } from "node-tradfri-client";
import { TradfriLight } from "./TradfriLight";
import { timeout } from "./Utils/Timeout";

export type TradfriGatewayIdentity = {
    identity: string
    psk: string
}

export class TradfriManager {
    /**
     * The current Tradfri Gateway instance.
     * @private
     */
    private tradfriGateway: TradfriClient

    /**
     * The lights received by the Gateway.
     * @private
     */
    private tradfriLights: Map<number, TradfriLight>

    /**
     * The authentication state of this manager to the Gateway.
     * @private
     */
    private authenticated: boolean

    /**
     * Creates the TradfriManager for the Tradfri Gateway at the given address.
     *
     * @constructor
     * @param ipAddress - IP Address where the Gateway can be reached
     */
    constructor(ipAddress: string) {
        this.tradfriGateway = new TradfriClient(ipAddress)
        this.tradfriLights = new Map<number, TradfriLight>()
        this.authenticated = false
    }

    /**
     * Authenticates the current manager against the Tradfri Gateway
     * using the security code printed on the device.
     *
     * @remarks
     * This way of authentication should only be used when authenticating for the
     * first time, after that use the returned Identity/PSK tokens.
     *
     * @param securityCode - The security code of the Gateway printed on the device.
     *
     * @returns A promise that returns the safe-to-save Identity/PSK combo for later authentication.
     */
    async authenticateWithSecurityCode(securityCode: string): Promise<TradfriGatewayIdentity> {
        const identityObject = await this.tradfriGateway.authenticate(securityCode)
        await this.authenticateWithIdentity(identityObject)

        return identityObject
    }

    /**
     * Authenticates the current manager against the Tradfri Gateway
     * using an Identity/PSK combo.
     *
     * @param identity - TradfriGatewayIdentity object
     */
    async authenticateWithIdentity(identity: TradfriGatewayIdentity) {
        await this.tradfriGateway.connect(identity.identity, identity.psk)
        this.authenticated = true
    }

    /**
     * Checks if this manager is authenticated against
     * the target Gateway.
     *
     * @returns boolean of the authentication state
     */
    isAuthenticated(): boolean {
        return this.authenticated
    }

    /**
     * Subscribes to events from the Gateway.
     */
    async startReceivingDeviceUpdates() {
        await this.tradfriGateway.on("device updated", this.tradfri_deviceUpdated.bind(this)).observeDevices()
    }

    /**
     * Returns a TradfriLight with the given id.
     *
     * @param deviceId - ID of the requested TradfriLight
     *
     * @returns - (TradfriLight | undefined) TradfriLight if found, undefined if not found
     */
    getLightFromDeviceId(deviceId: number): TradfriLight | undefined {
        return this.tradfriLights.get(deviceId)
    }

    /**
     * Sync TradfriLight state with Gateway.
     *
     * @param light - The TradfriLight object to be synced to the gateway
     */
    async syncLightState(light: TradfriLight) {
        await this.tradfriGateway.updateDevice(light.getAccessoryObject())
    }

    /**
     * Executes a sequence of LightOperations for the given light
     * with an optional timeout between operations and
     * return to the previous state of the light.
     *
     * @param light - Target TradfriLight
     * @param operations - LightOperations to be executed
     * @param timeoutBetweenOperations - (defaults to 0) Timeout in ms between the operations
     * @param revertToPreviousState - (defaults to false) If true, reverts the light to the previous state after the operations have been executed
     */
    async executeOperations(light: TradfriLight, operations: LightOperation[], timeoutBetweenOperations: number = 0, revertToPreviousState: boolean = false)  {
        const previousState = light.getLightObject().clone()

        for (const operation of operations) {
            await this.tradfriGateway.operateLight(light.getAccessoryObject(), operation, true)
            await timeout(timeoutBetweenOperations)
        }

        if (revertToPreviousState) {
            light.getLightObject().merge(previousState, true)
            await this.tradfriGateway.updateDevice(light.getAccessoryObject())
        }
    }

    /**
     * Executes a sequence of LightOperations on an array of lights
     * with an optional timeout between operations and
     * return to the previous state of the lights.
     *
     * @param lights - Target TradfriLights
     * @param operations - LightOperations to be executed
     * @param timeoutBetweenOperations - (defaults to 0) Timeout in ms between the operations
     * @param revertToPreviousState - (defaults to false) If true, reverts the light to the previous state after the operations have been executed
     */
    async executeOperationsMultiple(lights: TradfriLight[], operations: LightOperation[], timeoutBetweenOperations: number = 0, revertToPreviousState: boolean = false) {
        let promises = []

        for (const light of lights) {
            promises.push(this.executeOperations(light, operations, timeoutBetweenOperations, revertToPreviousState))
        }

        await Promise.all(promises)
    }

    /**
     * Returns all the TradfriLight instances connected to the Gateway.
     *
     * @returns - (TradfriLight[]) Lights connected to the Gateway
     */
    getTradfriLights(): TradfriLight[] {
        return Array.from(this.tradfriLights.values())
    }

    /**
     * Callback for the "device updated" event.
     *
     * @private
     * @param device
     */
    private tradfri_deviceUpdated(device: Accessory) {
        if (device.type == AccessoryTypes.lightbulb) {
            const light = new TradfriLight(this, device)
            this.tradfriLights.set(light.getDeviceId(), light)
        }
    }

}