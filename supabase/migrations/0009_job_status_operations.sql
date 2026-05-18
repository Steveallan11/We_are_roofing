alter type job_status add value if not exists 'Materials Ordered' after 'Materials Needed';
alter type job_status add value if not exists 'Scaffold In Situ' after 'Materials Ordered';
alter type job_status add value if not exists 'In Progress' after 'Booked';
alter type job_status add value if not exists 'Not Proceeding' after 'Completed';
