// --- Client en variabelen initialiseren ---
const SUPABASE_URL = 'https://czypzinmqgixqmxnvhxk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6eXB6aW5tcWdpeHFteG52aHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MjYxNzgsImV4cCI6MjA3MzUwMjE3OH0.2gIA40DWVyE5D68E-pt2zSEyBGC__Dnetrk35pH8gFo';

// ** GECORRIGEERDE REGEL **
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// HTML elementen die we vaker gebruiken
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const rittenLijstDiv = document.getElementById('ritten-lijst');
const userEmailSpan = document.getElementById('user-email');
const logoutButton = document.getElementById('logout-button');
const registerContainer = document.getElementById('register-container');
// Zorg ervoor dat de ID van de login container correct is in je HTML
const loginContainer = document.querySelector('#auth-container .form-container'); 

// --- Authenticatie Functies ---

document.getElementById('register-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const { error } = await supabaseClient.auth.signUp({ email, password });
    if (error) {
        alert(`Fout bij registreren: ${error.message}`);
    } else {
        alert('Registratie succesvol! Check je e-mail voor de bevestigingslink.');
    }
});

document.getElementById('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
        alert(`Fout bij inloggen: ${error.message}`);
    }
});

logoutButton.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
});

document.getElementById('show-register').addEventListener('click', (e) => {
    e.preventDefault();
    if(loginContainer) loginContainer.style.display = 'none';
    if(registerContainer) registerContainer.style.display = 'block';
});

document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    if(registerContainer) registerContainer.style.display = 'none';
    if(loginContainer) loginContainer.style.display = 'block';
});

// --- Data Functies ---

async function laadRitten(user) {
    rittenLijstDiv.innerHTML = '<p>Ritten worden geladen...</p>';
    try {
        const { data, error } = await supabaseClient
            .from('ritten')
            .select('*')
            .eq('status', 'actief')
            .order('created_at', { ascending: false });

        if (error) throw error;

        rittenLijstDiv.innerHTML = '';
        if (data.length === 0) {
            rittenLijstDiv.innerHTML = '<p>Er zijn op dit moment geen actieve oproepen.</p>';
        } else {
            data.forEach(rit => {
                const ritDiv = document.createElement('div');
                ritDiv.className = 'rit-item';
                const vertrekDatum = new Date(rit.vertrekdatum).toLocaleDateString('nl-NL');
                
                let ritHTML = `<h3>${rit.type.replace('_', ' ')}</h3><p><strong>Van:</strong> ${rit.van_plaats}</p><p><strong>Naar:</strong> ${rit.naar_plaats}</p><p><strong>Datum:</strong> ${vertrekDatum}</p><p><strong>Details:</strong> ${rit.details || 'Geen details opgegeven'}</p>`;
                
                if (user && user.id === rit.user_id) {
                    ritHTML += `<button class="delete-button" data-id="${rit.id}">Verwijder</button>`;
                }
                
                ritDiv.innerHTML = ritHTML;
                rittenLijstDiv.appendChild(ritDiv);
            });
        }
    } catch (error) {
        console.error('Er is een fout opgetreden:', error);
        rittenLijstDiv.innerHTML = `<p style="color: red; font-weight: bold;">Technische Fout:</p><pre>${error.message}</pre>`;
    }
}

document.getElementById('vervoer-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        alert('Je moet ingelogd zijn om een oproep te plaatsen.');
        return;
    }

    const form = event.target;
    const formData = new FormData(form);
    const ritData = Object.fromEntries(formData.entries());
    ritData.status = 'actief';
    ritData.user_id = session.user.id;

    const { error } = await supabaseClient.from('ritten').insert([ritData]);

    if (error) {
        alert(`Fout bij plaatsen oproep: ${error.message}`);
    } else {
        alert('Je oproep is succesvol geplaatst!');
        form.reset();
        laadRitten(session.user);
    }
});

rittenLijstDiv.addEventListener('click', async (event) => {
    if (event.target.classList.contains('delete-button')) {
        if (confirm('Weet je zeker dat je deze oproep wilt verwijderen?')) {
            const ritId = event.target.dataset.id;
            const { error } = await supabaseClient.from('ritten').delete().match({ id: ritId });
            
            if (error) {
                alert(`Fout bij verwijderen: ${error.message}`);
            } else {
                const { data: { session } } = await supabaseClient.auth.getSession();
                laadRitten(session.user);
            }
        }
    }
});

// --- Sessiebeheer ---
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session && session.user) {
        appContainer.style.display = 'block';
        authContainer.style.display = 'none';
        userEmailSpan.textContent = session.user.email;
        laadRitten(session.user);
    } else {
        appContainer.style.display = 'none';
        authContainer.style.display = 'block';
    }
});