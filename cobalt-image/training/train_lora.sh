#!/usr/bin/env bash
# LoRA fine-tuning launcher for the COBALT Image base (FLUX.2 [klein] 4B).
#
# UNTESTED: written on a machine with no GPU. It delegates to the DreamBooth
# LoRA example that ships in the diffusers repository; check that script's
# name and flags against the diffusers version you install before relying on
# this file.
#
#   1. python training/prepare_dataset.py images/ provenance.csv --out dataset/
#      then copy the accepted images next to dataset/metadata.jsonl
#   2. git clone https://github.com/huggingface/diffusers && pip install -e diffusers
#   3. DIFFUSERS=./diffusers DATASET=./dataset OUT=./cobalt-lora bash training/train_lora.sh
set -euo pipefail
: "${DIFFUSERS:?path to a diffusers checkout}"
: "${DATASET:?directory with images and metadata.jsonl}"
OUT="${OUT:-./cobalt-lora}"

accelerate launch "$DIFFUSERS/examples/dreambooth/train_dreambooth_lora_flux2_klein.py" \
  --pretrained_model_name_or_path black-forest-labs/FLUX.2-klein-4B \
  --dataset_name "$DATASET" --caption_column text \
  --output_dir "$OUT" \
  --mixed_precision bf16 \
  --resolution 1024 --train_batch_size 1 --gradient_accumulation_steps 4 \
  --gradient_checkpointing \
  --rank 16 --learning_rate 1e-4 --lr_scheduler constant \
  --max_train_steps 2000 --checkpointing_steps 500 \
  --seed 0
