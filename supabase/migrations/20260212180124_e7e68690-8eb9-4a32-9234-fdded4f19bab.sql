-- Clear partial imports from broken sync runs so fresh import works cleanly
DELETE FROM listings WHERE deal_source = 'captarget';