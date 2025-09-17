document.addEventListener('DOMContentLoaded', function() {
    const SUPABASE_URL = 'https://czypzinmqgixqmxnvhxk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6eXB6aW5tcWdpeHFteG52aHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MjYxNzgsImV4cCI6MjA3MzUwMjE3OH0.2gIA40DWVyE5D68E-pt2zSEyBGC__Dnetrk35pH8gFo';
    const { createClient } = supabase;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

    const rittenLijstContainer = document.getElementById('ritten-lijst');
    const vervoerForm = document.getElementById('vervoer-form');
    const successModal = document.getElementById('success-modal');
    const hoofdTitel = document.querySelector('h2#hoofdTitel');

    async function laadPagina() {
        const urlParams = new URLSearchParams(window.location.search);
        const editToken = urlParams.get('edit');

        if (editToken) {
            renderBeheerWeergave(editToken);
        } else {
            renderAlleRitten();
        }
    }

    async function renderAlleRitten() {
        rittenLijstContainer.innerHTML = '<p>Ritten worden geladen...</p>';
        try {
            const { data, error } = await supabaseClient.from('ritten').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            
            const vandaag = new Date();
            vandaag.setHours(0, 0, 0, 0);
            const activeData = data.filter(rit => {
                const vertrekDatum = new Date(rit.vertrekdatum);
                const dagenVerschil = (vandaag - vertrekDatum) / (1000 * 60 * 60 * 24);
                return dagenVerschil <= 3;
            });

            const groepen = {
                vraag_lift: [], aanbod_lift: [],
                vraag_transport: [], aanbod_transport: []
            };
            activeData.forEach(rit => groepen[rit.type]?.push(rit));
            
            rittenLijstContainer.innerHTML = '';
            
            const vraagLiftList = document.getElementById('vraag_lift_list');
            const aanbodLiftList = document.getElementById('aanbod_lift_list');
            const vraagTransportList = document.getElementById('vraag_transport_list');
            const aanbodTransportList = document.getElementById('aanbod_transport_list');
            
            vraagLiftList.innerHTML = '';
            aanbodLiftList.innerHTML = '';
            vraagTransportList.innerHTML = '';
            aanbodTransportList.innerHTML = '';
            
            renderGroep(groepen.vraag_lift, vraagLiftList);
            renderGroep(groepen.aanbod_lift, aanbodLiftList);
            renderGroep(groepen.vraag_transport, vraagTransportList);
            renderGroep(groepen.aanbod_transport, aanbodTransportList);

        } catch (error) {
            console.error('Fout bij laden:', error);
            rittenLijstContainer.innerHTML = `<p style="color:red;">Fout: ${error.message}</p>`;
        }
    }
    
    function renderGroep(data, container) {
        if (data.length === 0) {
            container.innerHTML = '<p><i>Geen oproepen in deze categorie.</i></p>';
        } else {
            data.forEach(rit => {
                const ritDiv = document.createElement('div');
                ritDiv.className = 'rit-item';
                const vertrekDatum = new Date(rit.vertrekdatum).toLocaleDateString('nl-NL');
                ritDiv.innerHTML = `
                    <h5>${rit.van_plaats} &rarr; ${rit.naar_plaats}</h5>
                    <p><strong>Door:</strong> ${rit.naam_oproeper || 'Onbekend'}</p>
                    <p><strong>Datum:</strong> ${vertrekDatum}</p>
                    <p><strong>Details:</strong> ${rit.details || 'Geen'}</p>
                    <p><strong>Contact:</strong> <a href="mailto:${rit.contact_info}">${rit.contact_info}</a></p>
                `;
                container.appendChild(ritDiv);
            });
        }
    }

    async function renderBeheerWeergave(editToken) {
        try {
            const { data, error } = await supabaseClient.from('ritten').select('*').eq('edit_token', editToken).single();
            if (error || !data) throw new Error("Oproep niet gevonden of ongeldige link.");
            
            vervoerForm.style.display = 'none';
            document.querySelector('.nav-buttons').style.display = 'none';
            document.querySelector('hr').style.display = 'none';
            hoofdTitel.textContent = 'Beheer Je Oproep';
            
            rittenLijstContainer.innerHTML = ''; 
            
            const rit = data;
            const vertrekDatum = new Date(rit.vertrekdatum).toLocaleDateString('nl-NL');
            const editUrl = `edit.html?edit=${rit.edit_token}`;
            
            const beheerDiv = document.createElement('div');
            beheerDiv.className = 'rit-item beheer-item';
            beheerDiv.innerHTML = `
                <h4>${rit.van_plaats} &rarr; ${rit.naar_plaats}</h4>
                <p><strong>Door:</strong> ${rit.naam_oproeper}</p>
                <p><strong>Datum:</strong> ${vertrekDatum}</p>
                <p><strong>Details:</strong> ${rit.details}</p>
                <p><strong>Contact:</strong> <a href="mailto:${rit.contact_info}">${rit.contact_info}</a></p>
                <hr>
                <div class="beheer-knoppen">
                    <a href="${editUrl}" class="edit-button">Pas oproep aan</a>
                    <button class="delete-button" data-id="${rit.id}">Verwijder oproep</button>
                </div>
            `;
            rittenLijstContainer.appendChild(beheerDiv);
        } catch (error) {
            console.error('Fout bij laden beheer-item:', error);
            rittenLijstContainer.innerHTML = `<p style="color:red;">Fout: ${error.message}</p>`;
        }
    }

    vervoerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(vervoerForm);
        const ritData = Object.fromEntries(formData.entries());
        ritData.edit_token = crypto.randomUUID();
        try {
            const { data, error } = await supabaseClient.from('ritten').insert([ritData]).select().single();
            if (error) throw error;
            
            await supabaseClient.functions.invoke('send-edit-link', {
                body: { toEmail: ritData.contact_info, editUrl: `${window.location.origin}${window.location.pathname}?edit=${ritData.edit_token}`, naamOproeper: ritData.naam_oproeper },
            });
            document.getElementById('modal-text').textContent = "Je oproep is geplaatst! Een e-mail met een link om je oproep te beheren is onderweg naar je toe gestuurd. Deze oproep wordt automatisch verwijderd 3 dagen na de door u opgegeven datum.";
            successModal.style.display = 'block';
            vervoerForm.reset();
            laadPagina();
        } catch (error) {
            alert(`Fout bij plaatsen: ${error.message}`);
        }
    });

    rittenLijstContainer.addEventListener('click', async (event) => {
        if (event.target.classList.contains('delete-button')) {
            if (confirm('Weet je zeker dat je deze oproep definitief wilt verwijderen?')) {
                const ritId = event.target.dataset.id;
                const { error } = await supabaseClient.from('ritten').delete().match({ id: ritId });
                if (error) {
                    alert(`Fout bij verwijderen: ${error.message}`);
                } else {
                    alert('Oproep succesvol verwijderd.');
                    window.location.href = 'index.html';
                }
            }
        }
    });

    document.getElementById('modal-ok-button').addEventListener('click', () => { window.location.href = 'https://www.nederlanders.fr/'; });
    document.getElementById('modal-new-button').addEventListener('click', () => { successModal.style.display = 'none'; vervoerForm.scrollIntoView({ behavior: 'smooth' }); });

    laadPagina();
});