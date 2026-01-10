document.addEventListener('DOMContentLoaded', function() {
    
    // --- CONFIGURATIE ---
    // Google Apps Script URL
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbycQLoscubb5d8oLjpQy2EAYB8p0ZTr0xc5U3eT7YRV5t88hy4-j0FwGehNdIUPUnyp_w/exec';

    const rittenLijstContainer = document.getElementById('ritten-lijst');
    const vervoerForm = document.getElementById('vervoer-form');
    const successModal = document.getElementById('success-modal');

    // Start de pagina: laad alleen de ritten (geen beheer/edit logica meer)
    laadRitten();

    async function laadRitten() {
        // Verberg de lijst en toon een laadmelding
        rittenLijstContainer.style.display = 'none';
        const laadMelding = document.createElement('p');
        laadMelding.id = 'laad-melding';
        laadMelding.textContent = 'Ritten worden geladen...';
        rittenLijstContainer.parentElement.insertBefore(laadMelding, rittenLijstContainer);

        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?timestamp=${new Date().getTime()}`);
            if (!response.ok) throw new Error('Kon de data niet ophalen van de server.');
            
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message);
            
            let data = result.data;
            // Sorteer op aanmaakdatum (nieuwste eerst)
            data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            
            // Filter: alleen ritten in de toekomst of max 3 dagen oud
            const vandaag = new Date();
            vandaag.setHours(0, 0, 0, 0);
            
            const activeData = data.filter(rit => {
                if (!rit.vertrekdatum) return false;
                const vertrekDatum = new Date(rit.vertrekdatum);
                const dagenVerschil = (vandaag - vertrekDatum) / (1000 * 60 * 60 * 24);
                // Toon ritten tot 3 dagen na vertrekdatum
                return dagenVerschil <= 3;
            });
            
            // Verdeel de ritten in groepen
            const groepen = { vraag_lift: [], aanbod_lift: [], vraag_transport: [], aanbod_transport: [] };
            activeData.forEach(rit => {
                if(groepen[rit.type]) {
                    groepen[rit.type].push(rit);
                }
            });
            
            renderGroep(groepen.vraag_lift, document.getElementById('vraag_lift_list'));
            renderGroep(groepen.aanbod_lift, document.getElementById('aanbod_lift_list'));
            renderGroep(groepen.vraag_transport, document.getElementById('vraag_transport_list'));
            renderGroep(groepen.aanbod_transport, document.getElementById('aanbod_transport_list'));
            
            // Verwijder laadmelding en toon de lijsten
            const bestaandeMelding = document.getElementById('laad-melding');
            if(bestaandeMelding) bestaandeMelding.remove();
            rittenLijstContainer.style.display = 'block';

        } catch (error) {
            console.error('Fout bij laden:', error);
            const bestaandeMelding = document.getElementById('laad-melding');
            if(bestaandeMelding) {
                bestaandeMelding.style.color = 'red';
                bestaandeMelding.textContent = `Fout: ${error.message}. Probeer de pagina te vernieuwen.`;
            }
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
                
                // --- Tekst verwerking met Limiet en Lees Meer ---
                let detailsRaw = rit.details ? String(rit.details) : 'Geen';
                let detailsHTML = '';
                const maxTekens = 1100;

                if (detailsRaw.length > maxTekens) {
                    const korteTekst = detailsRaw.substring(0, maxTekens).replace(/\n/g, '<br>');
                    const volledigeTekst = detailsRaw.replace(/\n/g, '<br>');
                    
                    // We maken een uniek ID voor de toggle
                    const uniekId = 'more-' + Math.random().toString(36).substr(2, 9);
                    
                    detailsHTML = `
                        <span id="short-${uniekId}">${korteTekst}... </span>
                        <span id="full-${uniekId}" style="display:none;">${volledigeTekst}</span>
                        <a href="javascript:void(0)" onclick="document.getElementById('short-${uniekId}').style.display='none'; document.getElementById('full-${uniekId}').style.display='inline'; this.style.display='none';" style="color:#800000; font-weight:bold; cursor:pointer;">[Lees meer]</a>
                    `;
                } else {
                    detailsHTML = detailsRaw.replace(/\n/g, '<br>');
                }

                ritDiv.innerHTML = `
                    <h5>${rit.van_plaats} &rarr; ${rit.naar_plaats}</h5>
                    <p><strong>Door:</strong> ${rit.naam_oproeper || 'Onbekend'}</p>
                    <p><strong>Datum:</strong> ${vertrekDatum}</p>
                    <p><strong>Details:</strong> ${detailsHTML}</p>
                    <p><strong>Contact:</strong> <a href="mailto:${rit.contact_info}">${rit.contact_info}</a></p>
                `;
                container.appendChild(ritDiv);
            });
        }
    }

    // --- FORMULIER VERZENDEN ---
    vervoerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        // Simpele validatie feedback knop
        const submitButton = vervoerForm.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        submitButton.textContent = 'Bezig met plaatsen...';
        submitButton.disabled = true;

        const formData = new FormData(vervoerForm);
        const ritData = Object.fromEntries(formData.entries());
        
        // Genereer basis meta-data
        ritData.id = new Date().getTime().toString();
        ritData.created_at = new Date().toISOString();
        // Edit token wordt niet meer gebruikt voor de user, maar kan intern handig zijn
        ritData.edit_token = crypto.randomUUID(); 
        ritData.action = 'insert'; 

        try {
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify(ritData)
            });
            
            // Check response (Google quirk handling)
            const resultText = await response.text(); 
            let result;
            try {
                 result = JSON.parse(resultText);
            } catch(e) {
                 // Geen JSON? Dan gaan we er even vanuit dat het goed ging
            }

            if (!response.ok) throw new Error('Er is een fout opgetreden bij het versturen.');
            
            // Nieuwe meldingstekst (Fire & Forget)
            document.getElementById('modal-text').innerHTML = `
                <p>Uw oproep is succesvol geplaatst!</p>
                <ul style="text-align:left; margin-top:10px;">
                    <li>Uw bericht staat nu live op de Vervoershub.</li>
                    <li><strong>Let op:</strong> U kunt deze oproep niet meer wijzigen of verwijderen.</li>
                    <li>Het bericht wordt automatisch verwijderd 3 dagen na de vertrekdatum.</li>
                </ul>
            `;
            
            successModal.style.display = 'block';
            vervoerForm.reset();
            
            // Herlaad de lijst op de achtergrond zodat de nieuwe rit zichtbaar is als men op OK klikt
            laadRitten();

        } catch (error) {
            console.error('Fout bij plaatsen:', error);
            alert(`Helaas is er een technische fout opgetreden:\n\n${error.message}`);
        } finally {
            submitButton.textContent = originalButtonText;
            submitButton.disabled = false;
        }
    });

    // Modal knoppen
    document.getElementById('modal-ok-button').addEventListener('click', () => { 
        successModal.style.display = 'none'; 
        // Scroll naar de lijst om het resultaat te zien
        rittenLijstContainer.scrollIntoView({ behavior: 'smooth' });
    });
    
    document.getElementById('modal-new-button').addEventListener('click', () => { 
        successModal.style.display = 'none'; 
        vervoerForm.scrollIntoView({ behavior: 'smooth' });
    });
});
