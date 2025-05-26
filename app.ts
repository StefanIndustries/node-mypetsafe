import {PetSafeClient} from "./src/mypetsafe-client";

async function main() {

    // if tokens are known, pass them to the petsafeclient constructor, otherwise, only use email and request code
    const client = new PetSafeClient('example@mail.com');
    await client.requestCode(); // sends email to request code. pass code to the requestTokensFromCode method
    const code = '000000';
    await client.requestTokensFromCode(code);

    const feeders = await client.getFeeders();
    const litterboxes = await client.getLitterboxes();
    const tokens = [client.getAccessToken, client.getIdToken, client.getRefreshToken, client.getSession];
    console.log('------ TOKENS -------')
    console.log(tokens);
    console.log('----------------------');

    console.log('------ FEEDERS -------');
    console.log(feeders);
    console.log('----------------------');

    console.log('------ LITTERBOXES -------');
    console.log(litterboxes);
    console.log('----------------------');

    client.onTokenRefreshed(({ idToken, accessToken, refreshToken }) => {
        console.log('Tokens refreshed:');
        console.log('ID Token:', idToken);
        console.log('Access Token:', accessToken);
        console.log('Refresh Token:', refreshToken);
    });
}

main().then(() => {
    console.log('Program done');
});