export function timeout(ms: number): Promise<null> {
    return new Promise(resolve => setTimeout(resolve, ms))
}