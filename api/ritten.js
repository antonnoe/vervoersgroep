// Server-side doorgeefluik naar Google Apps Script.
//
// Bezoekers die in hun browser met meerdere Google-accounts zijn ingelogd
// sturen bij een rechtstreekse fetch hun Google-cookies mee; Apps Script
// antwoordt dan met een foutpagina in plaats van JSON. Deze functie haalt de
// data server-side op, zonder cookies van de bezoeker, en geeft die door.

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzZTLO8e3OQCC6iZBGXCYz8YVLBH23att20npzUiP3uTsDZrq8zc3Xs8hZ9lR3BqNrU7g/exec';

const GET_TIMEOUT_MS = 10000;
const POST_TIMEOUT_MS = 15000;

function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function fetchMetTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, Object.assign({}, options, { signal: controller.signal }));
    } finally {
        clearTimeout(timer);
    }
}

async function handleGet(res) {
    const url = `${GOOGLE_SCRIPT_URL}?timestamp=${Date.now()}`;

    let tekst;
    try {
        const response = await fetchMetTimeout(url, { redirect: 'follow' }, GET_TIMEOUT_MS);
        tekst = await response.text();
        if (!response.ok) {
            res.status(502).json({ status: 'error', message: `Google antwoordde met status ${response.status}.` });
            return;
        }
    } catch (error) {
        const message = error && error.name === 'AbortError'
            ? 'Google reageerde niet binnen 10 seconden.'
            : 'Kon de data niet ophalen van Google.';
        res.status(502).json({ status: 'error', message });
        return;
    }

    let result;
    try {
        result = JSON.parse(tekst);
    } catch (error) {
        res.status(502).json({ status: 'error', message: 'Google gaf geen geldige JSON terug.' });
        return;
    }

    if (!result || result.status !== 'success') {
        const message = (result && result.message) || 'Google gaf geen geldig antwoord terug.';
        res.status(502).json({ status: 'error', message });
        return;
    }

    // Bij een hapering van Google blijft de laatste goede lijst zichtbaar.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=600');
    res.status(200).json(result);
}

async function handlePost(req, res) {
    const body = typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body === undefined ? {} : req.body);

    try {
        const response = await fetchMetTimeout(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: body,
            redirect: 'follow'
        }, POST_TIMEOUT_MS);

        const tekst = await response.text();
        res.setHeader('Cache-Control', 'no-store');
        res.status(response.status).send(tekst);
    } catch (error) {
        const message = error && error.name === 'AbortError'
            ? 'Google reageerde niet binnen 15 seconden.'
            : 'Kon de oproep niet doorgeven aan Google.';
        res.setHeader('Cache-Control', 'no-store');
        res.status(502).json({ status: 'error', message });
    }
}

module.exports = async function handler(req, res) {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.method === 'GET') {
        await handleGet(res);
        return;
    }

    if (req.method === 'POST') {
        await handlePost(req, res);
        return;
    }

    res.status(405).json({ status: 'error', message: 'Methode niet toegestaan.' });
};
