import { discoverGateway, TradfriErrorCodes } from "node-tradfri-client"
import { TradfriGatewayIdentity, TradfriManager } from "./Tradfri/TradfriManager";
import Vorpal from 'vorpal'
import { LocalStorage } from 'node-localstorage'
import { TradfriLight } from "./Tradfri/TradfriLight";

const localStorage = new LocalStorage('./storage')

let foundAddress: string | undefined
let tradfriManager: TradfriManager | undefined

const vorpal = new Vorpal()

vorpal.command('discover', 'Discovers IKEA Trådfri Gateways on your network.')
    .action(async () => {
        const result = await discoverGateway()
        if (result == null) {
            vorpal.log("Could not find an IKEA Trådfri gateway on the network.")
            return
        }

        foundAddress = result.addresses[0]

        vorpal.log(`Found IKEA Trådfri Gateway (${result.name}) at address ${foundAddress}.`)
        vorpal.log('Enter "connect" to connect to this Gateway.')
    })

vorpal.command('connect', 'Connects to the previously discovered IKEA Trådfri Gateway.')
    .action(async () => {
        if (foundAddress == undefined) {
            vorpal.log("No IKEA Trådfri Gateway previously discovered.")
            vorpal.log('Run the "discover" command first.')
            return
        }

        const storedIdentity = localStorage.getItem('idpsk')

        const answer = await vorpal.activeCommand.prompt([
            {
                name: 'authenticationMethod',
                type: 'list',
                message: 'How do you want to authenticate with this Gateway?',
                choices: () => {
                    let arr = [{ name: 'Security Code', value: 'code' }, { name: 'New Identity / PSK combination', value: 'newIdPsk' }]

                    if (storedIdentity != null) {
                        arr.push({ name: 'Stored Identity / PSK combination', value: 'storedIdPsk' })
                    }

                    return arr
                }
            },
            {
                name: 'securityCode',
                type: 'input',
                message: 'Enter the security code found on the back of the device: ',
                when: (answers: any) => {
                    return answers.authenticationMethod == 'code'
                }
            },
            {
                name: 'newIdentity',
                type: 'input',
                message: 'Enter the identity string to use for authentication: ',
                when: (answers: any) => {
                    return answers.authenticationMethod == 'newIdPsk'
                }
            },
            {
                name: 'newPSK',
                type: 'input',
                message: 'Enter the PSK string to use for authentication: ',
                when: (answers: any) => {
                    return answers.authenticationMethod == 'newIdPsk'
                }
            }
        ])

        tradfriManager = new TradfriManager(foundAddress)

        try {
            if (answer.authenticationMethod == 'code') {
                const securityCode = answer.securityCode
                const identityObject = await tradfriManager.authenticateWithSecurityCode(securityCode)

                localStorage.setItem('idpsk', JSON.stringify(identityObject))
            } else if (answer.authenticationMethod == 'newIdPsk') {
                const identity = answer.newIdentity
                const psk = answer.newPSK
                const identityObject: TradfriGatewayIdentity = { identity, psk }

                await tradfriManager.authenticateWithIdentity(identityObject)

                localStorage.setItem('idpsk', JSON.stringify(identityObject))
            } else if (answer.authenticationMethod == 'storedIdPsk') {
                if (storedIdentity != null) {
                    const identityObject = JSON.parse(storedIdentity) as TradfriGatewayIdentity
                    await tradfriManager.authenticateWithIdentity(identityObject)
                }
            }

            await tradfriManager.startReceivingDeviceUpdates()
            vorpal.log("Authenticated and connected successfully.")
        } catch (e) {
            if (e.code == TradfriErrorCodes.AuthenticationFailed) {
                vorpal.log('Could not authenticate with the given parameters.')
            }
        }
    })

vorpal.command('list', 'Lists the current lights connected to the IKEA Trådfri Gateway.')
    .action(async () => {
        if (tradfriManager == undefined || !tradfriManager.isAuthenticated()) {
            vorpal.log('You are not connected/authenticated to an IKEA Trådfri Gateway.')
            return
        }

        const lights = tradfriManager.getTradfriLights()
        vorpal.log('Showing all IKEA Trådfri Lightbulbs connected to the Gateway:')

        lights.map(light => light.getDeviceData()).forEach(data => {
            vorpal.log(`${data.name} (#${data.deviceId}) - ${data.spectrum}`)
        })
    })

vorpal.command('identify', 'Runs a sequence of operations for the user to identify the selected light.')
    .action(async () => {
        if (tradfriManager == undefined || !tradfriManager.isAuthenticated()) {
            vorpal.log('You are not connected/authenticated to an IKEA Trådfri Gateway.')
            return
        }

        const lights = await selectLights("Select the lights to identify:")
        if (lights == undefined) {
            vorpal.log("The selected lights couldn't be found.")
            return
        }

        vorpal.log("Identification sequence sent.")
        for (const light of lights) {
            light.identify().then(() => {})
        }
    })

vorpal.command('toggle', 'Toggles a light on or off.')
    .action(async () => {
        if (tradfriManager == undefined || !tradfriManager.isAuthenticated()) {
            vorpal.log('You are not connected/authenticated to an IKEA Trådfri Gateway.')
            return
        }

        const light = await selectLight("Select the light to toggle:")
        if (light == undefined) {
            vorpal.log("The selected light couldn't be found.")
            return
        }

        vorpal.log("Light toggled.")
        await light.toggle()
    })

vorpal.command('color', "Sets a light's color value.")
    .action(async () => {
        if (tradfriManager == undefined || !tradfriManager.isAuthenticated()) {
            vorpal.log('You are not connected/authenticated to an IKEA Trådfri Gateway.')
            return
        }

        const light = await selectLight("Select the light for which you want to change the color:")
        if (light == undefined) {
            vorpal.log("The selected light couldn't be found.")
            return
        }

        let color: string

        if (light.getDeviceData().spectrum == "rgb") {
            color = (await vorpal.activeCommand.prompt({
                name: 'color',
                type: 'input',
                message: "Enter the color 6-digit HEX value: "
            })).color
        } else {
            color = (await vorpal.activeCommand.prompt({
                name: 'color',
                type: 'list',
                message: "Select the color you want to change this light to: ",
                choices: [{ name: 'White (#F5FAF6)', value: 'f5faf6' }, { name: 'Warm (#F1E0B5)', value: 'f1e0b5' }, { name: 'Yellow (#EFD275)', value: 'efd275' }]
            })).color
        }

        await light.setColor(color)
    })

vorpal.command('brightness', "Sets a light's brightness value.")
    .action(async () => {
        if (tradfriManager == undefined || !tradfriManager.isAuthenticated()) {
            vorpal.log('You are not connected/authenticated to an IKEA Trådfri Gateway.')
            return
        }

        const light = await selectLight("Select the light for which you want to change the brightness:")
        if (light == undefined) {
            vorpal.log("The selected light couldn't be found.")
            return
        }

        const { brightness } = await vorpal.activeCommand.prompt({
            name: 'brightness',
            type: 'input',
            message: "Enter the brightness value (0-100): "
        })

        await light.setBrightness(Number(brightness))
    })

vorpal.delimiter("tradfri$").show()

async function selectLights(message: string): Promise<TradfriLight[] | undefined> {
    if (tradfriManager == undefined) {
        vorpal.log("An internal error has occurred.")
        return
    }

    const lights = tradfriManager.getTradfriLights()

    const data = await vorpal.activeCommand.prompt({
        name: 'lightIds',
        message,
        type: 'checkbox',
        choices: () => {
            return lights.map(light => light.getDeviceData()).map(data => {
                return {
                    name: `${data.name} (#${data.deviceId}) - ${data.spectrum}`,
                    value: data.deviceId
                }
            })
        }
    })

    return lights.filter(light => { return data.lightIds.find((lightId: number) => lightId == light.getDeviceId()) != undefined })
}

async function selectLight(message: string): Promise<TradfriLight | undefined> {
    if (tradfriManager == undefined) {
        vorpal.log("An internal error has occurred.")
        return
    }

    const lights = tradfriManager.getTradfriLights()

    const data = await vorpal.activeCommand.prompt({
        name: 'lightId',
        message,
        type: 'list',
        choices: () => {
            return lights.map(light => light.getDeviceData()).map(data => {
                return {
                    name: `${data.name} (#${data.deviceId}) - ${data.spectrum}`,
                    value: data.deviceId
                }
            })
        }
    })

    return tradfriManager.getLightFromDeviceId(data.lightId)
}