const fs = require('fs')

const getValues = (path = '.env') => {
    try {
        return fs
            .readFileSync(path, { encoding: 'utf-8' })
            .trim()
            .split('\n')
            .map(line => line.split(/=(.*)/))
            .reduce((acc, [key, value]) => {
                acc[key] = value
                return acc
            }, {})
    } catch (e) {
        return {}
    }
}


class ServerlessOfflineSSMProvider {
    constructor(serverless) {
        // This plugin should only do something when offline
        let isOffline = false
        const hasInput = serverless
            && serverless.processedInput
            && serverless.processedInput.commands
            && serverless.processedInput.commands.length > 0
        if (hasInput) {
            isOffline = serverless.processedInput.commands.some(c => c === 'offline')
        }
        if (!hasInput || !isOffline) {
            return
        }

        this.serverless = serverless
        this.config = this.serverless.service.custom['serverless-offline-ssm-provider']
        this.values = this.config ? getValues(this.config.file) : getValues()

        const aws = this.serverless.getProvider('aws')
        const request = aws.request.bind(aws)

        aws.request = (service, method, params, options) => {

            if (service !== 'SSM' || method !== 'getParameter')
                return request(service, method, params, options)

            const { Name } = params
            if (this.values[Name]) {
                return Promise.resolve({
                    Parameter: {
                        Value: this.values[Name]
                    }
                })
            }

            return request(service, method, params, options)
        }

        this.serverless.setProvider('aws', aws)
    }
}

module.exports = ServerlessOfflineSSMProvider
