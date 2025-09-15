// --- Client en variabelen initialiseren ---
const SUPABASE_URL = 'https://czypzinmqgixqmxnvhxk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6eXB6aW5tcWdpeHFteG52aHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MjYxNzgsImV4cCI6MjA3MzUwMjE3OH0.2gIA40DWVyE5D68E-pt2zSEyBGC__Dnetrk35pH8gFo';

// Belangrijk: we gebruiken nu de Supabase Client library
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// HTML elementen die we vaker gebruiken
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const rittenLijstDiv = document.getElementById('ritten-lijst');
const userEmailSpan = document.getElementById('user-email');
const logoutButton = document.getElementById('logout-button');
const registerContainer = document.getElementById('register-container');
const loginContainer = document.querySelector('#auth-container .form-container'); // Eerste form-container is login

// --- Authenticatie Functies ---

// Registreren van een nieuwe gebruiker
document.getElementById('register-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
        alert(`Fout bij registreren: ${error.message}`);
    } else {
        alert('Registratie succesvol! Check je e-mail voor de bevestigingslink.');
    }
});

// Inloggen van een bestaande gebruiker
document.getElementById('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        alert(`Fout bij inloggen: ${error.message}`);
    }
    // De onAuthStateChange handler regelt de rest (tonen van de app)
});

// Uitloggen
logoutButton.addEventListener('click', async () => {
    await supabase.auth.signOut();
    // De onAuthStateChange handler regelt de rest (tonen van het inlogscherm)
});

// Wisselen tussen login en registratie formulieren
document.getElementById('show-register').addEventListener('click', (e) => {
    e.preventDefault();
    loginContainer.style.display = 'none';
    registerContainer.style.display = 'block';
});

document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    registerContainer.style.display = 'none';
    loginContainer.style.display = 'block';
});

// --- Data Functies ---

// Ritten laden van de database
async function laadRitten(user) {
    rittenLijstDiv.innerHTML = '<p>Ritten worden geladen...</p>';
    const { data, error } = await supabase
        .from('ritten')
        .select('*')
        .eq('status', 'actief')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Fout bij ophalen ritten:', error);
        rittenLijstDiv.innerHTML = '<p>Er is een fout opgetreden bij het laden van de ritten.</p>';
        return;
    }

    rittenLijstDiv.innerHTML = '';
    if (data.length === 0) {
        rittenLijstDiv.innerHTML = '<p>Er zijn op dit moment geen actieve oproepen.</p>';
    } else {
        data.forEach(rit => {
            const ritDiv = document.createElement('div');
            ritDiv.className = 'rit-item';
            const vertrekDatum = new Date(rit.vertrekdatum).toLocaleDateString('nl-NL');
            
            // Bouw de HTML voor een rit
            let ritHTML = `
                <h3>${rit.type.replace('_', ' ')}</h3>
                <p><strong>Van:</strong> ${rit.van_plaats}</p>
                <p><strong>Naar:</strong> ${rit.naar_plaats}</p>
                <p><strong>Datum:</strong> ${vertrekDatum}</p>
                <p><strong>Details:</strong> ${rit.details || 'Geen details opgegeven'}</p>
            `;
            
            // Voeg een 'Verwijder'-knop toe als de ingelogde gebruiker de eigenaar is
            if (user && user.id === rit.user_id) {
                ritHTML += `<button class="delete-button" data-id="${rit.id}">Verwijder</button>`;
            }
            
            ritDiv.innerHTML = ritHTML;
            rittenLijstDiv.appendChild(ritDiv);
        });
    }
}

// Een nieuwe rit toevoegen
document.getElementById('vervoer-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        alert('Je moet ingelogd zijn om een oproep te plaatsen.');
        return;
    }

    const form = event.target;
    const formData = new FormData(form);
    const ritData = Object.fromEntries(formData.entries());
    ritData.status = 'actief';
    ritData.user_id = session.user.id; // Koppel de rit aan de ingelogde gebruiker

    const { error } = await supabase.from('ritten').insert([ritData]);

    if (error) {
        alert(`Fout bij plaatsen oproep: ${error.message}`);
    } else {
        alert('Je oproep is succesvol geplaatst!');
        form.reset();
        laadRitten(session.user);
    }
});

// Een rit verwijderen
rittenLijstDiv.addEventListener('click', async (event) => {
    if (event.target.classList.contains('delete-button')) {
        if (confirm('Weet je zeker dat je deze oproep wilt verwijderen?')) {
            const ritId = event.target.dataset.id;
            const { error } = await supabase.from('ritten').delete().match({ id: ritId });
            
            if (error) {
                alert(`Fout bij verwijderen: ${error.message}`);
            } else {
                const { data: { session } } = await supabase.auth.getSession();
                laadRitten(session.user); // Herlaad de lijst
            }
        }
    }
});


// --- Sessiebeheer ---

// Deze functie controleert continu of de gebruiker is in- of uitgelogd
// en past de weergave van de pagina daarop aan.
supabase.auth.onAuthStateChange((event, session) => {
    if (session && session.user) {
        // Gebruiker is ingelogd
        appContainer.style.display = 'block';
        authContainer.style.display = 'none';
        userEmailSpan.textContent = session.user.email;
        laadRitten(session.user);
    } else {
        // Gebruiker is uitgelogd
        appContainer.style.display = 'none';
        authContainer.style.display = 'block';
    }
});