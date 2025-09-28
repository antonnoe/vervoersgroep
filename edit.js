document.addEventListener('DOMContentLoaded', function() {
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxr0IID6SNXKzrH0gMXTN2qEWmLnIx-iDRAr0KiBkDT8c43Rli4EIPaBUuf_LLewUgCnQ/exec';

    const editForm = document.getElementById('edit-form');
    const loadingMessage = document.getElementById('loading-message');
    const urlParams = new URLSearchParams(window.location.search);
    const editToken = urlParams.get('edit');

    async function laadOproepData() {
        if (!editToken) {
            loadingMessage.innerHTML = '<p style="color:red;">Fout: Geen bewerk-token gevonden.</p>';
            return;
        }
        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?timestamp=${new Date().getTime()}`);
            if (!response.ok) throw new Error('Kon de data niet ophalen.');
            const result = await response.json();
            if (result.status !== 'success') throw new Error(result.message);

            const allData = result.data;
            const rit = allData.find(r => r.edit_token === editToken);
            if (!rit) throw new Error('Oproep niet gevonden of ongeldige link.');
            
            editForm.elements['type'].value = rit.type;
            editForm.elements['naam_oproeper'].value = rit.naam_oproeper;
            editForm.elements['van_plaats'].value = rit.van_plaats;
            editForm.elements['naar_plaats'].value = rit.naar_plaats;
            editForm.elements['vertrekdatum'].value = new Date(rit.vertrekdatum).toISOString().split('T')[0];
            editForm.elements['details'].value = rit.details;
            editForm.elements['contact_info'].value = rit.contact_info;
            
            loadingMessage.style.display = 'none';
            editForm.style.display = 'block';

        } catch (error) {
            loadingMessage.innerHTML = `<p style="color:red;">Fout: ${error.message}</p>`;
        }
    }

    // ... (De submit event listener blijft hetzelfde als in uw originele bestand)
}