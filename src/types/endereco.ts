export interface Coordenadas {
  latitude: number;
  longitude: number;
}

export interface Endereco {
  id?: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  coordenadas?: Coordenadas;
  endereco_completo?: string;
}

export interface EnderecoGeocodificado extends Endereco {
  coordenadas: Coordenadas;
  formatted_address: string;
}
