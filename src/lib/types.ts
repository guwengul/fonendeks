export type FonTipi = 'YAT' | 'EMK' | 'BYF'

export type TefasFonVerisi = {
  id: number
  tarih: string
  fonTipi: FonTipi
  fonKodu: string
  fonUnvan: string | null
  fiyat: number | null
  tedPaySayisi: number | null
  kisiSayisi: number | null
  portfoyBuyukluk: number | null
  borsaBultenFiyat: number | null
  created_at: string
}
