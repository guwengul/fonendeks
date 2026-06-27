'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function girisYap(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) return { hata: 'E-posta veya şifre hatalı.' }
  redirect('/')
}

export async function cikisYap() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}

export async function favoriEkle(fonKodu: string, fonTipi: string, fiyat: number, tarih: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { hata: 'Giriş gerekli' }
  const { count } = await supabase.from('tefas_favoriler')
    .select('*', { count: 'exact', head: true }).eq('user_id', user.id)
  if ((count ?? 0) >= 16) return { hata: 'Maksimum 16 favori ekleyebilirsiniz' }
  const { error } = await supabase.from('tefas_favoriler').upsert({
    user_id: user.id, fonKodu, fonTipi, ekleme_fiyati: fiyat, ekleme_tarihi: tarih,
  }, { onConflict: 'user_id,fonKodu,fonTipi', ignoreDuplicates: true })
  return error ? { hata: error.message } : { ok: true }
}

export async function favoriKaldir(fonKodu: string, fonTipi: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { hata: 'Giriş gerekli' }
  const { error } = await supabase.from('tefas_favoriler')
    .delete().eq('user_id', user.id).eq('fonKodu', fonKodu).eq('fonTipi', fonTipi)
  return error ? { hata: error.message } : { ok: true }
}

export async function portfoyOlustur(ad: string, renk: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { hata: 'Giriş gerekli' }
  const { count } = await supabase.from('tefas_portfoy')
    .select('*', { count: 'exact', head: true }).eq('user_id', user.id)
  if ((count ?? 0) >= 3) return { hata: 'En fazla 3 portföy oluşturabilirsiniz' }
  const { data, error } = await supabase.from('tefas_portfoy')
    .insert({ user_id: user.id, ad, renk }).select('id').single()
  return error ? { hata: error.message } : { ok: true, id: data.id }
}

const KATEGORI_GRUP: Record<string, string> = {
  'Hisse Senedi Fonu': 'Hisse Senedi',
  'Hisse Senedi Yoğun': 'Hisse Senedi',
  'Endeks Fon': 'Hisse Senedi',
  'Yabancı Hisse Senedi Fonu ': 'Hisse Senedi',
  'Yabancı Hisse Senedi Fonu': 'Hisse Senedi',
  'Katılım Hisse Senedi Fonu': 'Hisse Senedi',
  'Borçlanma Araçları Fonu': 'Borçlanma Araçları',
  'Kamu Borçlanma Araçları Fonu': 'Borçlanma Araçları',
  'Özel Sektör Borçlanma Araçları Fonu': 'Borçlanma Araçları',
  'Dış Borçlanma Araçları Fonu': 'Borçlanma Araçları',
  'Standart Fon': 'Borçlanma Araçları',
  'Kamu Yabancı Para (Döviz) Cinsinden Borçlanma Araç': 'Borçlanma Araçları',
  'Kira Sertifikası Fonu': 'Borçlanma Araçları',
  'Para Piyasası Fonu': 'Para Piyasası',
  'Kisa Vadeli Kira Sertifikalari Katilim Fonu': 'Para Piyasası',
  'Altın Fonu': 'Kıymetli Maden',
  'Altın Katılım Fonu': 'Kıymetli Maden',
  'Altın Ve Diğer Kıymetli Madenler Fonu': 'Kıymetli Maden',
  'Kıymetli Madenler': 'Kıymetli Maden',
  'Gümüş Fonu': 'Kıymetli Maden',
}

export async function portfoyIslemEkle(data: {
  fonKodu: string; fonTipi: string; islem_tipi: 'AL' | 'SAT'
  adet: number; fiyat: number; tarih: string; portfoy_id: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { hata: 'Giriş gerekli' }

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const { data: meta } = await admin.from('tefas_fon_meta')
    .select('fonKategori').eq('fonKodu', data.fonKodu).eq('fonTipi', data.fonTipi).single()
  const varlik_grubu = KATEGORI_GRUP[meta?.fonKategori ?? ''] ?? 'Karma / Değişken'

  const { error } = await supabase.from('tefas_portfoy_islem').insert({
    user_id: user.id,
    portfoy_id: data.portfoy_id,
    varlik_grubu,
    fonKodu: data.fonKodu, fonTipi: data.fonTipi,
    islem_tipi: data.islem_tipi, adet: data.adet,
    fiyat: data.fiyat, tarih: data.tarih,
  })
  return error ? { hata: error.message } : { ok: true }
}

export async function portfoyIslemGuncelle(id: string, adet: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { hata: 'Giriş gerekli' }
  if (adet <= 0) return { hata: 'Adet sıfırdan büyük olmalı' }
  const { error } = await supabase.from('tefas_portfoy_islem')
    .update({ adet }).eq('id', id).eq('user_id', user.id)
  return error ? { hata: error.message } : { ok: true }
}

export async function portfoyIslemSil(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { hata: 'Giriş gerekli' }
  const { error } = await supabase.from('tefas_portfoy_islem')
    .delete().eq('id', id).eq('user_id', user.id)
  return error ? { hata: error.message } : { ok: true }
}
