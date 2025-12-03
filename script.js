document.addEventListener('DOMContentLoaded', function() {
    // --- DEZE URL IS NU 100% CORRECT ---
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby9ux-idfN2v9FLjnlwc3bIVwINwW3O8vvLDbzP__HUDpITBW_Itpldnp0vRWyKo3JQSg/exec';
    const ZAPIER_INSERT_WEBHOOK = 'https://hooks.zapier.com/hooks/catch/624843/u11gttx/';

    const rittenLijstContainer = document.getElementById('ritten-lijst');
    const vervoerForm = document.getElementById('vervoer-form');
    const successModal = document.getElementById('success-modal');
    const hoofdTitel = document.querySelector('h2#hoofdTitel');

    async function laadPagina() {
        const urlParams = new URLSearchParams(window.location.search);
        const editToken = urlParams.get('edit');
        if (editToken) {
            await renderBeheerWeergave(editToken);
        } else {
            await renderAlleRitten();
        }
    }

    async function renderAlleRitten() {
        // We verbergen de rittenlijst container initieel en tonen deze pas na succesvol laden
        rittenLijstContainer.style.display = 'none';
        const laadMelding = document.createElement('p');
        laadMelding.textContent = 'Ritten worden geladen...';
        rittenLijstContainer.parentElement.insertBefore(laadMelding, rittenLijstContainer);

        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?timestamp=${new Date().getTime()}`);
            if (!response.ok) throw new Error('Kon de data niet ophalen van de server.');
            
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message);
            
            let data = result.data;
            data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            
            const vandaag = new Date();
            vandaag.setHours(0, 0, 0, 0);
            
            const activeData = data.filter(rit => {
                if (!rit.vertrekdatum) return false;
                const vertrekDatum = new Date(rit.vertrekdatum);
                const dagenVerschil = (vandaag - vertrekDatum) / (1000 * 60 * 60 * 24);
                return dagenVerschil <= 3;
            });
            
            const groepen = { vraag_lift: [], aanbod_lift: [], vraag_transport: [], aanbod_transport: [] };
            activeData.forEach(rit => groepen[rit.type]?.push(rit));
            
            renderGroep(groepen.vraag_lift, document.getElementById('vraag_lift_list'));
            renderGroep(groepen.aanbod_lift, document.getElementById('aanbod_lift_list'));
            renderGroep(groepen.vraag_transport, document.getElementById('vraag_transport_list'));
            renderGroep(groepen.aanbod_transport, document.getElementById('aanbod_transport_list'));
            
            // Toon de rittenlijst en verberg de laadmelding
            laadMelding.style.display = 'none';
            rittenLijstContainer.style.display = 'block';

        } catch (error) {
            console.error('Fout bij laden:', error);
            laadMelding.style.color = 'red';
            laadMelding.textContent = `Fout: ${error.message}. Probeer de pagina te vernieuwen.`;
        }
    }
    
    function renderGroep(data, container) {
        if (!container) return;
        container.innerHTML = '';
        if (data.length === 0) {
            container.innerHTML = '<p><i>Geen oproepen in deze categorie.</i></p>';
        } else {
            data.forEach(rit => {
                const ritDiv = document.createElement('div');
                ritDiv.className = 'rit-item';
                const vertrekDatum = new Date(rit.vertrekdatum).toLocaleDateString('nl-NL');
                const detailsHTML = rit.details ? String(rit.details).replace(/\n/g, '<br>') : 'Geen';
                ritDiv.innerHTML = `<h5>${rit.van_plaats} &rarr; ${rit.naar_plaats}</h5><p><strong>Door:</strong> ${rit.naam_oproeper || 'Onbekend'}</p><p><strong>Datum:</strong> ${vertrekDatum}</p><p><strong>Details:</strong> ${detailsHTML}</p><p><strong>Contact:</strong> <a href="mailto:${rit.contact_info}">${rit.contact_info}</a></p>`;
                container.appendChild(ritDiv);
            });
        }
    }

    async function renderBeheerWeergave(editToken) {
        const laadMelding = document.createElement('p');
        laadMelding.textContent = 'Oproep wordt geladen...';
        rittenLijstContainer.parentElement.insertBefore(laadMelding, rittenLijstContainer);

        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?timestamp=${new Date().getTime()}`);
            if (!response.ok) throw new Error('Kon de data niet ophalen.');
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message);

            const allData = result.data;
            const rit = allData.find(r => r.edit_token === editToken);
            if (!rit) throw new Error("Oproep niet gevonden of ongeldige link.");
            
            vervoerForm.parentElement.style.display = 'none';
            document.querySelector('.nav-buttons').style.display = 'none';
            document.querySelector('hr').style.display = 'none';
            hoofdTitel.textContent = 'Beheer Je Oproep';
            rittenLijstContainer.innerHTML = ''; 
            
            const vertrekDatum = new Date(rit.vertrekdatum).toLocaleDateString('nl-NL');
            const editUrl = `edit.html?edit=${rit.edit_token}`;
            const detailsHTML = rit.details ? String(rit.details).replace(/\n/g, '<br>') : 'Geen';
            
            const beheerDiv = document.createElement('div');
            beheerDiv.className = 'rit-item beheer-item';
            beheerDiv.innerHTML = `
                <h4>${rit.van_plaats} &rarr; ${rit.naar_plaats}</h4>
                <p><strong>Door:</strong> ${rit.naam_oproeper}</p><p><strong>Datum:</strong> ${vertrekDatum}</p>
                <p><strong>Details:</strong> ${detailsHTML}</p><p><strong>Contact:</strong> <a href="mailto:${rit.contact_info}">${rit.contact_info}</a></p>
                <hr>
                <div class="beheer-knoppen">
                    <a href="${editUrl}" class="edit-button">Pas oproep aan</a>
                    <button class="delete-button" data-token="${rit.edit_token}">Verwijder oproep</button>
                </div>
            `;
            laadMelding.style.display = 'none';
            rittenLijstContainer.appendChild(beheerDiv);
        } catch (error) {
            console.error('Fout bij laden beheer-item:', error);
            laadMelding.style.color = 'red';
            laadMelding.textContent = `Fout: ${error.message}`;
        }
    }

    vervoerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(vervoerForm);
        const ritData = Object.fromEntries(formData.entries());
        ritData.id = new Date().getTime().toString();
        ritData.created_at = new Date().toISOString();
        ritData.edit_token = crypto.randomUUID();
        try {
            const response = await fetch(ZAPIER_INSERT_WEBHOOK, { method: 'POST', body: JSON.stringify(ritData) });
            if (!response.ok) throw new Error('Er is een fout opgetreden bij het versturen van de data.');
            document.getElementById('modal-text').textContent = "Je oproep is geplaatst! Een e-mail met een link om je oproep te beheren is onderweg naar je toe gestuurd.";
            successModal.style.display = 'block';
            vervoerForm.reset();
        } catch (error) {
            console.error('Fout bij plaatsen:', error);
            alert(`Helaas is er een technische fout opgetreden:\n\n${error.message}`);
        }
    });

    rittenLijstContainer.addEventListener('click', async (event) => {
        if (event.target.classList.contains('delete-button')) {
            const button = event.target;
            button.textContent = 'Verwijderen...';
            button.disabled = true;
            const editToken = button.dataset.token;
            if (confirm('Weet je zeker dat je deze oproep definitief wilt verwijderen?')) {
                try {
                    // Gebruik nu een POST request naar dezelfde script URL
                    const response = await fetch(GOOGLE_SCRIPT_URL, {
                        method: 'POST',
                        body: JSON.stringify({ edit_token: editToken, action: 'delete' })
                    });
                    const result = await response.json();
                    if (result.status !== 'success') throw new Error(result.message);

                    alert('De oproep is succesvol verwijderd! De lijst wordt opnieuw geladen.');
                    window.location.href = 'index.html';
                } catch (error) {
                    console.error('Fout bij verwijderen:', error);
                    alert(`Er is een fout opgetreden bij het verwijderen: ${error.message}`);
                    button.textContent = 'Verwijder oproep';
                    button.disabled = false;
                }
            } else {
                button.textContent = 'Verwijder oproep';
                button.disabled = false;
            }
        }
    });

    document.getElementById('modal-ok-button').addEventListener('click', () => { window.location.href = 'https://www.nederlanders.fr/'; });
    document.getElementById('modal-new-button').addEventListener('click', () => { 
        successModal.style.display = 'none'; 
        vervoerForm.scrollIntoView({ behavior: 'smooth' });
    });

    laadPagina();

});
