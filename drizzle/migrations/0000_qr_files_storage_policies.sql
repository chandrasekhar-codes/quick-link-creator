
create policy "qr files anon upload"
on storage.objects for insert to anon, authenticated
with check (bucket_id = 'qr-files');

create policy "qr files read"
on storage.objects for select to anon, authenticated
using (bucket_id = 'qr-files');
