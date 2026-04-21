const HF_BLIP_MODEL_ID = "Salesforce/blip-image-captioning-base";

// * This file centralizes Hugging Face BLIP configuration, including model endpoint and API token management.
// * File ini memusatkan konfigurasi Hugging Face BLIP untuk validasi wajah mendeteksi sesuatu pada foto, lalu mengambil caption yang dihasilkan untuk menentukan apakah foto tersebut valid untuk absensi atau tidak.

// & Define the default Hugging Face BLIP model endpoint URL using the specified model ID.
// % Mendefinisikan URL endpoint model Hugging Face BLIP default menggunakan ID model yang ditentukan.
/** Mengekspor DEFAULT_HF_BLIP_URL untuk kebutuhan modul ini. */
export const DEFAULT_HF_BLIP_URL = `https://router.huggingface.co/hf-inference/models/${HF_BLIP_MODEL_ID}`;

// & If a custom Hugging Face BLIP URL is not set in environment variables, fallback to the default model endpoint.
// % Jika URL Hugging Face BLIP khusus tidak diatur dalam variabel lingkungan, gunakan endpoint model default sebagai fallback.
/** Mengekspor FALLBACK_HF_BLIP_URL untuk kebutuhan modul ini. */
export const FALLBACK_HF_BLIP_URL = `https://router.huggingface.co/hf-inference/models/${HF_BLIP_MODEL_ID}`;

// & Retrieve the Hugging Face BLIP URL from environment variables, with a fallback to the default URL if not set.
// % Mengambil URL Hugging Face BLIP dari variabel lingkungan, dengan fallback ke URL default jika tidak diatur.
/** Mengekspor HF_BLIP_URL untuk kebutuhan modul ini. */
export const HF_BLIP_URL =
  Bun.env.HF_BLIP_URL ||
  Bun.env.VITE_HF_BLIP_URL ||
  process.env.HF_BLIP_URL ||
  process.env.VITE_HF_BLIP_URL ||
  DEFAULT_HF_BLIP_URL;

// & Retrieve the Hugging Face API token from environment variables, with a fallback to undefined if not set.
// % Mengambil token API Hugging Face dari variabel lingkungan, dengan fallback ke undefined jika tidak diatur.
/** Mengekspor HF_API_TOKEN untuk kebutuhan modul ini. */
export const HF_API_TOKEN =
  Bun.env.HF_API_TOKEN ||
  Bun.env.VITE_HF_API_TOKEN ||
  process.env.HF_API_TOKEN ||
  process.env.VITE_HF_API_TOKEN;
