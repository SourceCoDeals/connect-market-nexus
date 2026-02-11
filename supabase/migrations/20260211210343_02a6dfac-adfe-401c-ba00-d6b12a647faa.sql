-- Fix Canadian province full names
UPDATE listings SET address_state = 'AB' WHERE address_state = 'Alberta';
UPDATE listings SET address_state = 'BC' WHERE address_state = 'British Columbia';
UPDATE listings SET address_state = 'ON' WHERE address_state = 'Ontario';
UPDATE listings SET address_state = 'QC' WHERE address_state = 'Quebec';
UPDATE listings SET address_state = 'MB' WHERE address_state = 'Manitoba';
UPDATE listings SET address_state = 'SK' WHERE address_state = 'Saskatchewan';
UPDATE listings SET address_state = 'NS' WHERE address_state = 'Nova Scotia';
UPDATE listings SET address_state = 'NB' WHERE address_state = 'New Brunswick';
UPDATE listings SET address_state = 'NL' WHERE address_state = 'Newfoundland and Labrador';
UPDATE listings SET address_state = 'PE' WHERE address_state = 'Prince Edward Island';