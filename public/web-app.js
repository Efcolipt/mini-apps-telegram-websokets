const app = window.Telegram.WebApp;
// const storage = app.CloudStorage;

const conn = new WebSocket("ws://vn1840.vps-server.ru:5017");

class CryptoManager {
	#Crypto = цшт

    generateKeyPair() {
        return this.#Crypto.generateKeyPairSync("rsa", { modulusLength: 2048, })
    }

    encryptMessage(packageData, hashKey, serverCertificate) {
        const stringForHash = "type=echo&data.message=" + packageData.data.message;

        const signature = this.#Crypto.createHmac("sha256", hashKey).update(stringForHash).digest('hex').toUpperCase();

        packageData.signature = signature;

        const aesKey = this.#Crypto.randomBytes(32);
        const aesIV = this.#Crypto.randomBytes(16);


        let cipher = this.#Crypto.createCipheriv('aes-256-cbc', aesKey, aesIV);

        let encrypted = cipher.update(JSON.stringify(packageData), 'utf8', 'base64');

        encrypted += cipher.final('base64');

        const result = Buffer.from(encrypted, 'base64');

        const cipherSecret = this.#Crypto.publicEncrypt(
            {
                key: serverCertificate,
                padding: Crypto.constants.RSA_PKCS1_PADDING,
                oaepHash: "sha256",
            },
            Buffer.concat([aesKey, aesIV])
        );

        return Buffer.concat([cipherSecret, result]).toString('base64');
    }

    decryptMessage(ciphered, privateKey) {
        const bytes = Buffer.from(ciphered, 'base64')
        const cipheredSecret = bytes.slice(0, 256);
        const payload = bytes.slice(256, bytes.length);

        const secret = this.#Crypto.privateDecrypt(
            {
                key: privateKey,
                padding: Crypto.constants.RSA_PKCS1_PADDING,
                oaepHash: "sha256",
            },
            cipheredSecret
        );

        const aesKey = secret.slice(0, 32);
        const aesIV = secret.slice(32, 48);

        const decipher = this.#Crypto.createDecipheriv('aes-256-cbc', aesKey, aesIV);
        const decrypted = decipher.update(payload, 'base64', 'utf8');

        return JSON.parse((decrypted + decipher.final('utf8')));
    }
}

class Fetcher {
    #CryptoManager = new CryptoManager()

    #isWasInitRequest = false

    #connection = null

    #cryptoKeys = {
        publicKey: null, 
        privateKey: null
    }

    constructor(connection) {
        this.#connection = connection

        this.#init()
    }

    #init() {
		this.#connection.onopen = () => {
			this.#cryptoKeys = this.#CryptoManager.generateKeyPair();
			this.send({
				publicKey: this.#cryptoKeys.publicKey.export({ type: "pkcs1", format: "pem" })
			});
		}
		

        this.#connection.onclose = (error) => {
            console.log("Connection Error: " + error.toString());
        };
    
        this.#connection.onerror = () => {
            console.log('echo-protocol Connection Closed');
        }

        this.#connection.onmessage = (e) => this.#receive(e.data)
    }

    #receive(message) {
        if (message.type === 'utf8') {
            console.log("Received: " + message.utf8Data);
        }

        if (!this.#isWasInitRequest) {
            const response = this.#CryptoManager.decryptMessage(message.utf8Data, this.#cryptoKeys.privateKey);

            const request = this.#CryptoManager.encryptMessage(this.#toRequest({ message: '' }, 'echo'), response.data.hashKey, response.data.publicKey)

            this.#connection.send(request);

            this.#isWasInitRequest = true;
        }
    }

    send(data, type = 'init', signature = '') {
        const request = this.#toRequest(data, type, signature);

        this.#connection.send(JSON.stringify(request));
    }

    #toRequest(data, type = 'init', signature = '') {
        return {
            type,
            data,
            signature
        }
    }
}


const fetcher = new Fetcher(conn)

app.ready();
app.expand();

export {};