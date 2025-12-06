/**
 * TextureRegionSelector - Modal component for selecting texture regions during export
 * Displays texture with UV overlay and allows user to draw a bounding box
 */

class TextureRegionSelector {
    constructor() {
        this.dialog = null;
        this.canvas = null;
        this.ctx = null;
        this.textureCanvas = null;
        this.uvPolygons = [];
        this.sectionName = '';
        this.scale = 1;
        
        this.selection = null;
        this.isDragging = false;
        this.dragStart = null;
        
        this.onConfirm = null;
        this.onSkip = null;
        this.onCancel = null;
        this.onReuseTexture = null;
        
        this.dragOffset = { x: 0, y: 0 };
        this.isDraggingDialog = false;

        this.existingTextures = [];
        this.selectedExistingTexture = null;
        this.isReuseMode = false;

        this.duplicateCheckbox = null;
        this.duplicateAtEnd = false;
        
        this.createDOM();
        this.bindEvents();
    }
    
    createDOM() {
        this.dialog = document.createElement('dialog');
        this.dialog.className = 'texture-region-dialog';
        this.dialog.innerHTML = `
            <div class="trs-header">
                <span class="trs-title">Select Texture Region</span>
                <span class="trs-section-name"></span>
            </div>
            <div class="trs-body">
                <div class="trs-reuse-section" style="display: none;">
                    <div class="trs-reuse-header">
                        <label class="trs-reuse-toggle">
                            <input type="checkbox" class="trs-reuse-checkbox">
                            <span>Reuse existing texture</span>
                        </label>
                    </div>
                    <div class="trs-reuse-dropdown" style="display: none;">
                        <select class="trs-texture-select"></select>
                    </div>
                </div>
                <div class="trs-canvas-section">
                    <div class="trs-canvas-container">
                        <canvas class="trs-canvas"></canvas>
                    </div>
                    <div class="trs-info">
                        <div class="trs-region-info">
                            <span>Region: </span>
                            <span class="trs-region-values">Click and drag to select</span>
                        </div>
                        <div class="trs-hint">
                            Selection snaps to 32px grid. Minimum size: 64x64. UV triangles shown in cyan.
                        </div>
                        <label class="trs-duplicate-toggle">
                            <input type="checkbox" class="trs-duplicate-checkbox">
                            <span>Create a duplicate section at the end</span>
                        </label>
                    </div>
                </div>
            </div>
            <div class="trs-footer">
                <button class="trs-btn trs-btn-cancel">Cancel Export</button>
                <button class="trs-btn trs-btn-skip">Skip Section</button>
                <button class="trs-btn trs-btn-confirm" disabled>Confirm Region</button>
            </div>
        `;
        
        this.injectStyles();
        document.body.appendChild(this.dialog);
        
        this.canvas = this.dialog.querySelector('.trs-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.sectionNameEl = this.dialog.querySelector('.trs-section-name');
        this.regionValuesEl = this.dialog.querySelector('.trs-region-values');
        this.confirmBtn = this.dialog.querySelector('.trs-btn-confirm');
        this.skipBtn = this.dialog.querySelector('.trs-btn-skip');
        this.cancelBtn = this.dialog.querySelector('.trs-btn-cancel');
        this.header = this.dialog.querySelector('.trs-header');
        
        this.reuseSection = this.dialog.querySelector('.trs-reuse-section');
        this.reuseCheckbox = this.dialog.querySelector('.trs-reuse-checkbox');
        this.reuseDropdown = this.dialog.querySelector('.trs-reuse-dropdown');
        this.textureSelect = this.dialog.querySelector('.trs-texture-select');
        this.canvasSection = this.dialog.querySelector('.trs-canvas-section');
        this.duplicateCheckbox = this.dialog.querySelector('.trs-duplicate-checkbox');
    }
    
    injectStyles() {
        if (document.getElementById('trs-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'trs-styles';
        style.textContent = `
            .texture-region-dialog {
                position: fixed;
                border: 2px solid #3a5a8a;
                border-radius: 8px;
                background: #1a1a25;
                color: #c0c0d0;
                padding: 0;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                max-width: 90vw;
                max-height: 90vh;
            }
            .texture-region-dialog::backdrop {
                background: rgba(0,0,0,0.3);
            }
            .trs-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                background: #252535;
                border-bottom: 1px solid #3a5a8a;
                cursor: move;
                user-select: none;
                border-radius: 6px 6px 0 0;
            }
            .trs-title {
                font-weight: bold;
                font-size: 1rem;
            }
            .trs-section-name {
                color: #4ad474;
                font-size: 0.9rem;
            }
            .trs-body {
                padding: 16px;
            }
            .trs-canvas-container {
                background: #000;
                border: 1px solid #3a5a8a;
                border-radius: 4px;
                overflow: hidden;
                display: inline-block;
            }
            .trs-canvas {
                display: block;
                cursor: crosshair;
            }
            .trs-info {
                margin-top: 12px;
                font-size: 0.85rem;
            }
            .trs-region-info {
                margin-bottom: 6px;
            }
            .trs-region-values {
                color: #4ad474;
                font-family: monospace;
            }
            .trs-hint {
                color: #888;
                font-size: 0.75rem;
            }
            .trs-duplicate-toggle {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-top: 8px;
                cursor: pointer;
                font-size: 0.85rem;
            }
            .trs-duplicate-toggle input {
                width: 16px;
                height: 16px;
                cursor: pointer;
            }
            .trs-footer {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                padding: 12px 16px;
                border-top: 1px solid #3a5a8a;
                background: #252535;
                border-radius: 0 0 6px 6px;
            }
            .trs-btn {
                padding: 8px 16px;
                border: 1px solid #3a5a8a;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.85rem;
                transition: background 0.2s;
            }
            .trs-btn-cancel {
                background: #4a2a2a;
                color: #e0a0a0;
            }
            .trs-btn-cancel:hover {
                background: #5a3a3a;
            }
            .trs-btn-skip {
                background: #3a3a4a;
                color: #a0a0c0;
            }
            .trs-btn-skip:hover {
                background: #4a4a5a;
            }
            .trs-btn-confirm {
                background: #2a4a3a;
                color: #a0e0c0;
            }
            .trs-btn-confirm:hover:not(:disabled) {
                background: #3a5a4a;
            }
            .trs-btn-confirm:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .trs-reuse-section {
                margin-bottom: 12px;
                padding: 10px;
                background: #252535;
                border-radius: 4px;
                border: 1px solid #3a5a8a;
            }
            .trs-reuse-header {
                display: flex;
                align-items: center;
            }
            .trs-reuse-toggle {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                font-size: 0.9rem;
            }
            .trs-reuse-toggle input {
                width: 16px;
                height: 16px;
                cursor: pointer;
            }
            .trs-reuse-dropdown {
                margin-top: 10px;
            }
            .trs-texture-select {
                width: 100%;
                padding: 8px;
                background: #1a1a25;
                border: 1px solid #3a5a8a;
                border-radius: 4px;
                color: #c0c0d0;
                font-size: 0.85rem;
                cursor: pointer;
            }
            .trs-texture-select option {
                background: #1a1a25;
                padding: 4px;
            }
            .trs-canvas-section.disabled {
                opacity: 0.4;
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);
    }
    
    bindEvents() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));
        
        this.header.addEventListener('mousedown', (e) => this.onHeaderMouseDown(e));
        document.addEventListener('mousemove', (e) => this.onHeaderMouseMove(e));
        document.addEventListener('mouseup', () => this.onHeaderMouseUp());
        
        this.confirmBtn.addEventListener('click', () => {
            if (this.isReuseMode && this.selectedExistingTexture !== null) {
                if (this.onReuseTexture) {
                    this.onReuseTexture(this.selectedExistingTexture, this.duplicateAtEnd);
                }
            } else if (this.selection && this.onConfirm) {
                this.onConfirm(this.getSelectedRegion(), this.duplicateAtEnd);
            }
        });
        
        this.skipBtn.addEventListener('click', () => {
            if (this.onSkip) this.onSkip();
        });
        
        this.cancelBtn.addEventListener('click', () => {
            if (this.onCancel) this.onCancel();
        });

        this.reuseCheckbox.addEventListener('change', () => {
            this.isReuseMode = this.reuseCheckbox.checked;
            this.reuseDropdown.style.display = this.isReuseMode ? 'block' : 'none';
            this.canvasSection.classList.toggle('disabled', this.isReuseMode);
            this.updateConfirmState();
        });
        
        this.textureSelect.addEventListener('change', () => {
            const value = this.textureSelect.value;
            this.selectedExistingTexture = value !== '' ? parseInt(value) : null;
            this.updateConfirmState();
        });

        this.duplicateCheckbox.addEventListener('change', () => {
            this.duplicateAtEnd = this.duplicateCheckbox.checked;
        });
    }
    
    onHeaderMouseDown(e) {
        if (e.target.tagName === 'BUTTON') return;
        this.isDraggingDialog = true;
        const rect = this.dialog.getBoundingClientRect();
        this.dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        e.preventDefault();
    }
    
    onHeaderMouseMove(e) {
        if (!this.isDraggingDialog) return;
        const x = e.clientX - this.dragOffset.x;
        const y = e.clientY - this.dragOffset.y;
        this.dialog.style.left = `${Math.max(0, x)}px`;
        this.dialog.style.top = `${Math.max(0, y)}px`;
        this.dialog.style.margin = '0';
    }
    
    onHeaderMouseUp() {
        this.isDraggingDialog = false;
    }
    
    show(sectionName, textureCanvas, uvPolygons, suggestedRegion = null, existingTextures = []) {
        this.sectionName = sectionName;
        this.textureCanvas = textureCanvas;
        this.uvPolygons = uvPolygons || [];
        this.selection = suggestedRegion ? { ...suggestedRegion } : null;
        this.existingTextures = existingTextures || [];
        this.isReuseMode = false;
        this.selectedExistingTexture = null;
        this.duplicateAtEnd = false;

        this.sectionNameEl.textContent = sectionName;

        this.reuseCheckbox.checked = false;
        this.reuseDropdown.style.display = 'none';
        this.canvasSection.classList.remove('disabled');
        this.duplicateCheckbox.checked = false;
        
        if (this.existingTextures.length > 0) {
            this.reuseSection.style.display = 'block';
            this.textureSelect.innerHTML = '<option value="">-- Select texture --</option>';
            this.existingTextures.forEach((tex, idx) => {
                const option = document.createElement('option');
                option.value = tex.texIndex;
                option.textContent = `Texture ${tex.texIndex}: ${tex.name} (${tex.region.width}x${tex.region.height})`;
                this.textureSelect.appendChild(option);
            });
        } else {
            this.reuseSection.style.display = 'none';
        }
        
        const maxWidth = 600;
        const maxHeight = 400;
        const texW = textureCanvas.width;
        const texH = textureCanvas.height;
        
        this.scale = Math.min(maxWidth / texW, maxHeight / texH, 2);
        this.canvas.width = texW * this.scale;
        this.canvas.height = texH * this.scale;
        
        this.render();
        this.updateRegionInfo();
        this.updateConfirmState();
        
        this.dialog.style.left = '';
        this.dialog.style.top = '';
        this.dialog.style.margin = '';
        this.dialog.showModal();
    }
    
    updateConfirmState() {
        if (this.isReuseMode) {
            this.confirmBtn.disabled = this.selectedExistingTexture === null;
            this.confirmBtn.textContent = 'Use Selected Texture';
        } else {
            this.confirmBtn.disabled = !this.selection;
            this.confirmBtn.textContent = 'Confirm Region';
        }
    }
    
    hide() {
        this.dialog.close();
    }
    
    snapToGrid(value, gridSize = 32) {
        return Math.round(value / gridSize) * gridSize;
    }
    
    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.scale;
        const y = (e.clientY - rect.top) / this.scale;
        
        this.isDragging = true;
        this.dragStart = { x: this.snapToGrid(x), y: this.snapToGrid(y) };
        this.selection = {
            x: this.dragStart.x,
            y: this.dragStart.y,
            width: 64,
            height: 64
        };
    }
    
    onMouseMove(e) {
        if (!this.isDragging) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.scale;
        const y = (e.clientY - rect.top) / this.scale;
        
        const snappedX = this.snapToGrid(x);
        const snappedY = this.snapToGrid(y);
        
        const minX = Math.min(this.dragStart.x, snappedX);
        const minY = Math.min(this.dragStart.y, snappedY);
        const maxX = Math.max(this.dragStart.x, snappedX);
        const maxY = Math.max(this.dragStart.y, snappedY);
        
        this.selection = {
            x: minX,
            y: minY,
            width: Math.max(64, maxX - minX),
            height: Math.max(64, maxY - minY)
        };
        
        this.clampSelection();
        this.render();
        this.updateRegionInfo();
    }
    
    onMouseUp(e) {
        if (this.isDragging) {
            this.isDragging = false;
            this.confirmBtn.disabled = !this.selection;
        }
    }
    
    clampSelection() {
        if (!this.selection || !this.textureCanvas) return;
        
        const texW = this.textureCanvas.width;
        const texH = this.textureCanvas.height;
        
        if (this.selection.x < 0) this.selection.x = 0;
        if (this.selection.y < 0) this.selection.y = 0;
        if (this.selection.x + this.selection.width > texW) {
            this.selection.width = texW - this.selection.x;
        }
        if (this.selection.y + this.selection.height > texH) {
            this.selection.height = texH - this.selection.y;
        }
        
        this.selection.width = Math.max(64, this.snapToGrid(this.selection.width));
        this.selection.height = Math.max(64, this.snapToGrid(this.selection.height));
    }
    
    updateRegionInfo() {
        if (this.selection) {
            this.regionValuesEl.textContent = 
                `X: ${this.selection.x}, Y: ${this.selection.y}, ` +
                `W: ${this.selection.width}, H: ${this.selection.height}`;
        } else {
            this.regionValuesEl.textContent = 'Click and drag to select';
        }
        this.updateConfirmState();
    }
    
    render() {
        const ctx = this.ctx;
        const scale = this.scale;
        
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        ctx.imageSmoothingEnabled = false;
        if (this.textureCanvas) {
            ctx.drawImage(
                this.textureCanvas, 
                0, 0, 
                this.textureCanvas.width * scale, 
                this.textureCanvas.height * scale
            );
        }
        
        this.drawGrid();
        this.drawUVPolygons();
        this.drawSelection();
    }
    
    drawGrid() {
        const ctx = this.ctx;
        const scale = this.scale;
        const texW = this.textureCanvas?.width || 256;
        const texH = this.textureCanvas?.height || 256;
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        
        for (let x = 32; x < texW; x += 32) {
            ctx.beginPath();
            ctx.moveTo(x * scale, 0);
            ctx.lineTo(x * scale, texH * scale);
            ctx.stroke();
        }
        
        for (let y = 32; y < texH; y += 32) {
            ctx.beginPath();
            ctx.moveTo(0, y * scale);
            ctx.lineTo(texW * scale, y * scale);
            ctx.stroke();
        }
    }
    
    drawUVPolygons() {
        const ctx = this.ctx;
        const scale = this.scale;
        
        ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        
        this.uvPolygons.forEach(poly => {
            if (!poly || poly.length < 3) return;
            
            ctx.beginPath();
            ctx.moveTo(poly[0].u * scale, poly[0].v * scale);
            for (let i = 1; i < poly.length; i++) {
                ctx.lineTo(poly[i].u * scale, poly[i].v * scale);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        });
    }
    
    drawSelection() {
        if (!this.selection) return;
        
        const ctx = this.ctx;
        const scale = this.scale;
        const { x, y, width, height } = this.selection;
        
        ctx.fillStyle = 'rgba(74, 212, 116, 0.2)';
        ctx.fillRect(x * scale, y * scale, width * scale, height * scale);
        
        ctx.strokeStyle = '#4ad474';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x * scale, y * scale, width * scale, height * scale);
        ctx.setLineDash([]);
        
        ctx.fillStyle = '#4ad474';
        ctx.font = '12px monospace';
        ctx.fillText(`${width}x${height}`, x * scale + 4, y * scale + 14);
    }
    
    getSelectedRegion() {
        if (!this.selection) return null;
        return {
            x: this.selection.x,
            y: this.selection.y,
            width: this.selection.width,
            height: this.selection.height
        };
    }
    
    setCallbacks(onConfirm, onSkip, onCancel, onReuseTexture) {
        this.onConfirm = onConfirm;
        this.onSkip = onSkip;
        this.onCancel = onCancel;
        this.onReuseTexture = onReuseTexture;
    }
}

window.TextureRegionSelector = TextureRegionSelector;
