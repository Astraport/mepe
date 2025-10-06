// Enhanced Game Classes and Logic for FUD Arena Survivor

// --- ENHANCED CLASSES ---
class Player {
    constructor(x, y) {
        this.sprite = new PIXI.Sprite(textures.player);
        this.sprite.anchor.set(0.5);
        this.sprite.x = x;
        this.sprite.y = y;
        this.sprite.scale.set(1.2);
        
        this.hpBar = new PIXI.Graphics();
        this.sprite.addChild(this.hpBar);
        
        this.shieldBar = new PIXI.Graphics();
        this.sprite.addChild(this.shieldBar);
        
        this.aura = new PIXI.Graphics();
        this.sprite.addChild(this.aura);
        
        worldContainer.addChild(this.sprite);

        this.hp = playerStats.hp;
        this.lastAttackTime = 0;
        this.lastHitTime = 0;
    }

    get x() { return this.sprite.x; }
    get y() { return this.sprite.y; }
    get width() { return this.sprite.width; }
    get height() { return this.sprite.height; }

    draw() {
        // HP bar
        this.hpBar.clear();
        this.hpBar.beginFill(0xff0000);
        this.hpBar.drawRect(-this.width/2, this.height/2 + 8, this.width, 6);
        this.hpBar.beginFill(0x00ff00);
        this.hpBar.drawRect(-this.width/2, this.height/2 + 8, this.width * (this.hp / playerStats.maxHp), 6);
        this.hpBar.endFill();

        // Shield bar
        if (playerStats.shield.active && playerStats.shield.hp > 0) {
            this.shieldBar.clear();
            this.shieldBar.beginFill(0x0066ff);
            this.shieldBar.drawRect(-this.width/2, this.height/2 + 16, this.width * (playerStats.shield.hp / playerStats.shield.maxHp), 4);
            this.shieldBar.endFill();
        } else {
            this.shieldBar.clear();
        }

        // Hit effect
        const isHit = Date.now() - this.lastHitTime < 200;
        this.sprite.alpha = isHit && Math.floor(Date.now() / 50) % 2 === 0 ? 0.5 : 1;
        
        // Aura
        this.aura.clear();
        if (playerStats.damageAura.active) {
            this.aura.lineStyle(3, 0x64ff64, 0.3);
            this.aura.drawCircle(0, 0, playerStats.damageAura.range);
        }
        if (playerStats.shield.active && playerStats.shield.hp > 0) {
            this.aura.lineStyle(2, 0x0066ff, 0.4);
            this.aura.drawCircle(0, 0, this.width/2 + 10);
        }
    }
    
    update(delta) {
        let moveX = 0, moveY = 0;
        
        if (joystickActive) {
            moveX = joystickDir.x; moveY = joystickDir.y;
        } else {
            if (keys['w'] || keys['ArrowUp']) moveY = -1;
            if (keys['s'] || keys['ArrowDown']) moveY = 1;
            if (keys['a'] || keys['ArrowLeft']) moveX = -1;
            if (keys['d'] || keys['ArrowRight']) moveX = 1;
        }

        if (moveX !== 0 || moveY !== 0) {
            const length = Math.sqrt(moveX * moveX + moveY * moveY);
            this.sprite.x += (moveX / length) * playerStats.speed * delta;
            this.sprite.y += (moveY / length) * playerStats.speed * delta;
            
            // Create movement particles
            if (Math.random() < 0.3) {
                particles.push(new Particle(this.x, this.y + this.height/2, 'dust'));
            }
        }

        // Flip sprite based on horizontal movement
        if (moveX > 0.1) {
            this.sprite.scale.x = -1.2;
        } else if (moveX < -0.1) {
            this.sprite.scale.x = 1.2;
        }
        
        // Counter-flip children
        const scaleX = this.sprite.scale.x;
        this.hpBar.scale.x = Math.abs(scaleX) / scaleX;
        this.shieldBar.scale.x = Math.abs(scaleX) / scaleX;
        this.aura.scale.x = Math.abs(scaleX) / scaleX;

        // World bounds
        this.sprite.x = Math.max(this.width / 2, Math.min(app.screen.width - this.width / 2, this.sprite.x));
        this.sprite.y = Math.max(this.height / 2, Math.min(app.screen.height - this.height / 2, this.sprite.y));

        // Shield regeneration
        if (playerStats.shield.active && playerStats.shield.hp < playerStats.shield.maxHp) {
            if (Date.now() - playerStats.shield.lastRegen > 2000) { // 2 sec delay
                playerStats.shield.hp = Math.min(playerStats.shield.maxHp, 
                    playerStats.shield.hp + playerStats.shield.regenRate * delta / 60);
            }
        }

        // Attack
        if (Date.now() - this.lastAttackTime > playerStats.attackCooldown) {
            this.shoot();
            this.lastAttackTime = Date.now();
        }

        // Aura damage
        if (playerStats.damageAura.active && Date.now() - playerStats.damageAura.lastTick > playerStats.damageAura.cooldown) {
            enemies.forEach(enemy => {
                const dist = Math.hypot(this.x - enemy.x, this.y - enemy.y);
                if (dist < playerStats.damageAura.range + enemy.width/2) {
                    enemy.takeDamage(playerStats.damageAura.damage, true);
                }
            });
            bosses.forEach(boss => {
                const dist = Math.hypot(this.x - boss.x, this.y - boss.y);
                if (dist < playerStats.damageAura.range + boss.width/2) {
                    boss.takeDamage(playerStats.damageAura.damage, true);
                }
            });
            playerStats.damageAura.lastTick = Date.now();
        }

        this.draw();
    }
    
    shoot() {
        const nearestEnemy = findNearestEnemy(this.x, this.y);
        if (!nearestEnemy) return;

        sounds.shot.play();
        
        for (let i = 0; i < playerStats.projectileCount; i++) {
            const angle = Math.atan2(nearestEnemy.y - this.y, nearestEnemy.x - this.x);
            const spread = (Math.random() - 0.5) * 0.4;
            const finalAngle = angle + spread;
            const dx = Math.cos(finalAngle);
            const dy = Math.sin(finalAngle);
            
            // Critical hit calculation
            const isCrit = Math.random() < playerStats.critChance;
            const damage = isCrit ? playerStats.projectileDamage * playerStats.critMultiplier : playerStats.projectileDamage;
            
            projectiles.push(new Projectile(this.x, this.y, dx, dy, playerStats.projectileSpeed, damage, isCrit));
        }
    }
    
    takeDamage(damage) {
        if (Date.now() - this.lastHitTime > 300) {
            // Shield absorbs damage first
            if (playerStats.shield.active && playerStats.shield.hp > 0) {
                const shieldDamage = Math.min(damage, playerStats.shield.hp);
                playerStats.shield.hp -= shieldDamage;
                damage -= shieldDamage;
                playerStats.shield.lastRegen = Date.now();
                
                // Shield break effect
                if (playerStats.shield.hp <= 0) {
                    for (let i = 0; i < 8; i++) {
                        particles.push(new Particle(this.x, this.y, 'shieldBreak'));
                    }
                }
            }
            
            // Remaining damage to health
            if (damage > 0) {
                this.hp -= damage;
                this.lastHitTime = Date.now();
                
                // Blood particles
                for (let i = 0; i < 3; i++) {
                    particles.push(new Particle(this.x, this.y, 'blood'));
                }
                
                if (this.hp <= 0) {
                    this.hp = 0;
                    endGame();
                }
            }
        }
    }

    addXp(amount) {
        sounds.xp.play();
        
        // Combo master bonus
        if (playerStats.comboMaster) {
            amount = Math.floor(amount * 1.25);
        }
        
        playerStats.xp += amount * combo;
        if (playerStats.xp >= playerStats.xpToNextLevel) {
            this.levelUp();
        }
        xpFill.style.width = `${(playerStats.xp / playerStats.xpToNextLevel) * 100}%`;
        
        // XP gain particle
        particles.push(new Particle(this.x, this.y - 20, 'xpGain', amount * combo));
    }
    
    levelUp() {
        sounds.levelUp.play();
        playerStats.xp -= playerStats.xpToNextLevel;
        playerStats.level++;
        playerStats.xpToNextLevel = Math.floor(playerStats.xpToNextLevel * 1.4);
        levelText.textContent = playerStats.level;
        
        // Level up particles
        for (let i = 0; i < 15; i++) {
            particles.push(new Particle(this.x, this.y, 'levelUp'));
        }
        
        gameState = 'levelup';
        showLevelUpModal();
    }

    destroy() {
        worldContainer.removeChild(this.sprite);
    }
}

class Enemy {
    constructor(x, y, type) {
        this.type = type;
        this.lastHitTime = 0;
        this.freezeTime = 0;
        this.originalSpeed = 0;

        this.currentAngle = Math.atan2(player.y - y, player.x - x);
        this.turnSpeed = 0.06;

        switch(type) {
            case 'PaperHands':
                this.sprite = new PIXI.Sprite(textures.paperHands);
                this.speed = 2.2 + Math.random() * 0.8;
                this.hp = 12 + wave * 3;
                this.damage = 4;
                this.xpValue = 1;
                this.scoreValue = 10;
                break;
            case 'Bear':
                this.sprite = new PIXI.Sprite(textures.bear);
                this.speed = 1.2 + Math.random() * 0.4;
                this.hp = 60 + wave * 15;
                this.damage = 12;
                this.xpValue = 5;
                this.scoreValue = 50;
                break;
            case 'Whale':
                this.sprite = new PIXI.Sprite(textures.whale);
                this.speed = 0.8 + Math.random() * 0.3;
                this.hp = 120 + wave * 25;
                this.damage = 20;
                this.xpValue = 10;
                this.scoreValue = 100;
                break;
        }
        this.originalSpeed = this.speed;
        this.maxHp = this.hp;
        this.sprite.anchor.set(0.5);
        this.sprite.x = x;
        this.sprite.y = y;
        this.sprite.scale.set(type === 'Whale' ? 1.3 : 1);

        this.hpBar = new PIXI.Graphics();
        this.sprite.addChild(this.hpBar);
        worldContainer.addChild(this.sprite);
    }

    get x() { return this.sprite.x; }
    get y() { return this.sprite.y; }
    get width() { return this.sprite.width; }
    get height() { return this.sprite.height; }

    draw() {
        // HP bar
        this.hpBar.clear();
        if(this.hp < this.maxHp){
            this.hpBar.beginFill(0xff0000);
            this.hpBar.drawRect(-this.width/2, -this.height/2 - 10, this.width, 6);
            this.hpBar.beginFill(0x00ff00);
            this.hpBar.drawRect(-this.width/2, -this.height/2 - 10, this.width * (this.hp / this.maxHp), 6);
            this.hpBar.endFill();
        }
        
        // Hit effect
        const isHit = Date.now() - this.lastHitTime < 150;
        this.sprite.tint = isHit ? 0xff9999 : (this.freezeTime > 0 ? 0x99ccff : 0xffffff);
    }

    update(delta) {
        // Freeze effect
        if (this.freezeTime > 0) {
            this.freezeTime -= delta;
            this.speed = this.originalSpeed * 0.3;
        } else {
            this.speed = this.originalSpeed;
        }
        
        const targetAngle = Math.atan2(player.y - this.y, player.x - this.x);
        
        let angleDiff = targetAngle - this.currentAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        this.currentAngle += angleDiff * this.turnSpeed * delta;

        this.sprite.x += Math.cos(this.currentAngle) * this.speed * delta;
        this.sprite.y += Math.sin(this.currentAngle) * this.speed * delta;
        
        // Flip sprite
        const horizontalDirection = Math.cos(this.currentAngle);
        if (horizontalDirection > 0) {
            this.sprite.scale.x = this.type === 'Whale' ? -1.3 : -1;
        } else if (horizontalDirection < 0) {
            this.sprite.scale.x = this.type === 'Whale' ? 1.3 : 1;
        }
        this.hpBar.scale.x = this.sprite.scale.x / Math.abs(this.sprite.scale.x);
        
        this.draw();
    }

    takeDamage(damage, fromAura = false) {
        this.hp -= damage;
        this.lastHitTime = Date.now();
        
        if (!fromAura) {
            // Damage number particle
            particles.push(new Particle(this.x, this.y - 20, 'damage', damage));
        }
        
        if (this.hp <= 0) {
            sounds.enemyDeath.play();
            killCount++;
            updateCombo();
            score += this.scoreValue * combo;
            
            // Death explosion
            for (let i = 0; i < 6; i++) {
                particles.push(new Particle(this.x, this.y, 'explosion'));
            }
            
            xpOrbs.push(new XpOrb(this.x, this.y, this.xpValue));
            this.destroy();
            enemies = enemies.filter(e => e !== this);
        }
    }

    freeze(duration = 180) {
        this.freezeTime = Math.max(this.freezeTime, duration);
    }

    destroy() {
        worldContainer.removeChild(this.sprite);
    }
}

class Boss {
    constructor(x, y) {
        this.type = 'Boss';
        this.sprite = new PIXI.Sprite(textures.boss);
        this.sprite.anchor.set(0.5);
        this.sprite.x = x;
        this.sprite.y = y;
        this.sprite.scale.set(1.5);
        
        this.speed = 0.8;
        this.hp = 500 + wave * 100;
        this.maxHp = this.hp;
        this.damage = 25;
        this.xpValue = 50;
        this.scoreValue = 1000;
        
        this.lastAttackTime = 0;
        this.lastHitTime = 0;
        this.attackCooldown = 2000;
        
        this.hpBar = new PIXI.Graphics();
        this.sprite.addChild(this.hpBar);
        
        worldContainer.addChild(this.sprite);
    }

    get x() { return this.sprite.x; }
    get y() { return this.sprite.y; }
    get width() { return this.sprite.width; }
    get height() { return this.sprite.height; }

    draw() {
        // Big HP bar above boss
        this.hpBar.clear();
        this.hpBar.beginFill(0xff0000);
        this.hpBar.drawRect(-this.width/2, -this.height/2 - 20, this.width, 10);
        this.hpBar.beginFill(0xff6600);
        this.hpBar.drawRect(-this.width/2, -this.height/2 - 20, this.width * (this.hp / this.maxHp), 10);
        this.hpBar.endFill();
        
        // Hit effect
        const isHit = Date.now() - this.lastHitTime < 200;
        this.sprite.tint = isHit ? 0xff9999 : 0xffffff;
    }

    update(delta) {
        // Move towards player
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.sprite.x += Math.cos(angle) * this.speed * delta;
        this.sprite.y += Math.sin(angle) * this.speed * delta;
        
        // Boss special attack
        if (Date.now() - this.lastAttackTime > this.attackCooldown) {
            this.specialAttack();
            this.lastAttackTime = Date.now();
        }
        
        // Flip sprite
        if (Math.cos(angle) > 0) {
            this.sprite.scale.x = -1.5;
        } else {
            this.sprite.scale.x = 1.5;
        }
        this.hpBar.scale.x = this.sprite.scale.x / Math.abs(this.sprite.scale.x);
        
        this.draw();
    }

    specialAttack() {
        // Spawn ring of projectiles
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);
            projectiles.push(new EnemyProjectile(this.x, this.y, dx, dy, 3, this.damage / 2));
        }
    }

    takeDamage(damage, fromAura = false) {
        this.hp -= damage;
        this.lastHitTime = Date.now();
        
        if (!fromAura) {
            particles.push(new Particle(this.x, this.y - 30, 'damage', damage));
        }
        
        if (this.hp <= 0) {
            sounds.enemyDeath.play();
            killCount++;
            updateCombo();
            score += this.scoreValue * combo;
            
            // Epic death explosion
            for (let i = 0; i < 20; i++) {
                particles.push(new Particle(this.x, this.y, 'explosion'));
            }
            
            // Multiple XP orbs
            for (let i = 0; i < 5; i++) {
                const offsetX = (Math.random() - 0.5) * 60;
                const offsetY = (Math.random() - 0.5) * 60;
                xpOrbs.push(new XpOrb(this.x + offsetX, this.y + offsetY, this.xpValue));
            }
            
            this.destroy();
            bosses = bosses.filter(b => b !== this);
            bossSpawned = false;
        }
    }

    destroy() {
        worldContainer.removeChild(this.sprite);
    }
}

class Projectile {
    constructor(x, y, dx, dy, speed, damage, isCrit = false) {
        this.sprite = new PIXI.Sprite(textures.projectile);
        this.sprite.anchor.set(0.5);
        this.sprite.x = x;
        this.sprite.y = y;
        this.sprite.scale.set(isCrit ? 1.5 : 1);
        this.sprite.tint = isCrit ? 0xff6600 : 0xffffff;
        worldContainer.addChild(this.sprite);

        this.dx = dx;
        this.dy = dy;
        this.speed = speed;
        this.damage = damage;
        this.isCrit = isCrit;
        this.pierceCount = playerStats.piercing;
        this.lifetime = 0;
        this.target = null;
        
        if (playerStats.homingShots) {
            this.target = findNearestEnemy(x, y);
        }
    }
    
    get x() { return this.sprite.x; }
    get y() { return this.sprite.y; }
    get width() { return this.sprite.width; }
    get height() { return this.sprite.height; }
    
    update(delta) {
        this.lifetime += delta;
        
        // Homing behavior
        if (playerStats.homingShots && this.target && this.lifetime > 10) {
            const targetAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            const currentAngle = Math.atan2(this.dy, this.dx);
            
            let angleDiff = targetAngle - currentAngle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            const turnSpeed = 0.1;
            const newAngle = currentAngle + angleDiff * turnSpeed;
            this.dx = Math.cos(newAngle);
            this.dy = Math.sin(newAngle);
        }
        
        this.sprite.x += this.dx * this.speed * delta;
        this.sprite.y += this.dy * this.speed * delta;
        
        // Trail effect for crit shots
        if (this.isCrit && Math.random() < 0.5) {
            particles.push(new Particle(this.x, this.y, 'trail'));
        }
    }

    explode() {
        if (playerStats.explosiveShots) {
            // Explosion damage to nearby enemies
            const explosionRadius = 80;
            enemies.forEach(enemy => {
                const dist = Math.hypot(this.x - enemy.x, this.y - enemy.y);
                if (dist < explosionRadius) {
                    enemy.takeDamage(this.damage * 0.6);
                }
            });
            bosses.forEach(boss => {
                const dist = Math.hypot(this.x - boss.x, this.y - boss.y);
                if (dist < explosionRadius) {
                    boss.takeDamage(this.damage * 0.6);
                }
            });
            
            // Explosion particles
            for (let i = 0; i < 8; i++) {
                particles.push(new Particle(this.x, this.y, 'explosion'));
            }
        }
    }

    destroy() {
        worldContainer.removeChild(this.sprite);
    }
}

class EnemyProjectile {
    constructor(x, y, dx, dy, speed, damage) {
        this.sprite = new PIXI.Sprite(textures.projectile);
        this.sprite.anchor.set(0.5);
        this.sprite.x = x;
        this.sprite.y = y;
        this.sprite.tint = 0xff0000;
        worldContainer.addChild(this.sprite);

        this.dx = dx;
        this.dy = dy;
        this.speed = speed;
        this.damage = damage;
    }
    
    get x() { return this.sprite.x; }
    get y() { return this.sprite.y; }
    get width() { return this.sprite.width; }
    get height() { return this.sprite.height; }
    
    update(delta) {
        this.sprite.x += this.dx * this.speed * delta;
        this.sprite.y += this.dy * this.speed * delta;
    }

    destroy() {
        worldContainer.removeChild(this.sprite);
    }
}

class Particle {
    constructor(x, y, type, value = null) {
        this.sprite = new PIXI.Graphics();
        this.sprite.x = x;
        this.sprite.y = y;
        this.type = type;
        this.value = value;
        this.life = 60;
        this.maxLife = 60;
        
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
        
        switch(type) {
            case 'explosion':
                this.vx = (Math.random() - 0.5) * 8;
                this.vy = (Math.random() - 0.5) * 8;
                break;
            case 'blood':
                this.vy = Math.random() * 2 + 1;
                break;
            case 'dust':
                this.vy = -Math.random() * 2;
                this.life = 30;
                this.maxLife = 30;
                break;
            case 'damage':
                this.vy = -2;
                this.life = 90;
                this.maxLife = 90;
                break;
            case 'xpGain':
                this.vy = -1;
                this.life = 120;
                this.maxLife = 120;
                break;
            case 'levelUp':
                this.vx = (Math.random() - 0.5) * 6;
                this.vy = -Math.random() * 4 - 2;
                this.life = 120;
                this.maxLife = 120;
                break;
        }
        
        effectsContainer.addChild(this.sprite);
        this.draw();
    }
    
    draw() {
        this.sprite.clear();
        const alpha = this.life / this.maxLife;
        
        switch(this.type) {
            case 'explosion':
                this.sprite.beginFill(0xff6600, alpha);
                this.sprite.drawCircle(0, 0, 6 * (1 - alpha + 0.5));
                break;
            case 'blood':
                this.sprite.beginFill(0xcc0000, alpha);
                this.sprite.drawCircle(0, 0, 3);
                break;
            case 'dust':
                this.sprite.beginFill(0x888888, alpha * 0.5);
                this.sprite.drawCircle(0, 0, 2);
                break;
            case 'damage':
                this.sprite.beginFill(0xffff00, alpha);
                this.sprite.drawCircle(0, 0, 8);
                break;
            case 'xpGain':
                this.sprite.beginFill(0x00ff00, alpha);
                this.sprite.drawCircle(0, 0, 6);
                break;
            case 'levelUp':
                this.sprite.beginFill(0xffd700, alpha);
                this.sprite.drawStar(0, 0, 5, 8, 4);
                break;
            case 'shieldBreak':
                this.sprite.beginFill(0x0066ff, alpha);
                this.sprite.drawCircle(0, 0, 4);
                break;
            case 'trail':
                this.sprite.beginFill(0xff6600, alpha * 0.7);
                this.sprite.drawCircle(0, 0, 3);
                break;
        }
        this.sprite.endFill();
    }
    
    update(delta) {
        this.sprite.x += this.vx * delta;
        this.sprite.y += this.vy * delta;
        this.life -= delta;
        
        // Gravity for some particles
        if (this.type === 'blood' || this.type === 'explosion') {
            this.vy += 0.2 * delta;
        }
        
        this.draw();
    }
    
    destroy() {
        effectsContainer.removeChild(this.sprite);
    }
}

class XpOrb {
    constructor(x, y, value) {
        this.sprite = new PIXI.Sprite(textures.xpOrb);
        this.sprite.anchor.set(0.5);
        this.sprite.x = x;
        this.sprite.y = y;
        this.sprite.scale.set(0.8 + value * 0.1);
        worldContainer.addChild(this.sprite);

        this.value = value;
        this.speed = 5;
        this.bobOffset = Math.random() * Math.PI * 2;
        this.time = 0;
    }

    get x() { return this.sprite.x; }
    get y() { return this.sprite.y; }
    get width() { return this.sprite.width; }
    get height() { return this.sprite.height; }

    update(delta) {
        this.time += delta / 20;
        
        // Bobbing animation
        this.sprite.y += Math.sin(this.time + this.bobOffset) * 0.5;
        this.sprite.rotation += 0.05 * delta;
        
        // Magnetic pull
        const dist = Math.hypot(this.x - player.x, this.y - player.y);
        if (dist < playerStats.magnetRange) {
            const angle = Math.atan2(player.y - this.y, player.x - this.x);
            this.sprite.x += Math.cos(angle) * this.speed * delta;
            this.sprite.y += Math.sin(angle) * this.speed * delta;
        }
    }

    destroy() {
        worldContainer.removeChild(this.sprite);
    }
}

class HealthPack {
    constructor(x, y) {
        this.sprite = new PIXI.Sprite(textures.healthPack);
        this.sprite.anchor.set(0.5);
        this.sprite.x = x;
        this.sprite.y = y;
        this.sprite.scale.set(1.2);
        worldContainer.addChild(this.sprite);
        this.healAmount = playerStats.maxHp * 0.25;
        this.time = 0;
    }
    
    get x() { return this.sprite.x; }
    get y() { return this.sprite.y; }
    get width() { return this.sprite.width; }
    get height() { return this.sprite.height; }
    
    update(delta) {
        this.time += delta / 20;
        this.sprite.y += Math.sin(this.time) * 0.5;
    }
    
    destroy() {
        worldContainer.removeChild(this.sprite);
    }
}

// --- GAME FUNCTIONS ---
function init() {
    worldContainer.removeChildren();
    effectsContainer.removeChildren();

    // Reset stats
    Object.assign(playerStats, {
        speed: 3, maxHp: 100, hp: 100, level: 1, xp: 0, xpToNextLevel: 15,
        attackCooldown: 600, projectileSpeed: 6, projectileDamage: 15,
        projectileCount: 1, magnetRange: 120, critChance: 0.05, critMultiplier: 2,
        piercing: 0, homingShots: false, explosiveShots: false, freezeShots: false,
        comboMaster: false,
        damageAura: { active: false, damage: 0, range: 0, cooldown: 800, lastTick: 0 },
        shield: { active: false, hp: 0, maxHp: 0, regenRate: 5, lastRegen: 0 }
    });
    
    player = new Player(app.screen.width / 2, app.screen.height / 2);
    enemies = [];
    projectiles = [];
    xpOrbs = [];
    healthPacks = [];
    particles = [];
    bosses = [];
    gameTime = 0;
    killCount = 0;
    score = 0;
    combo = 1;
    maxCombo = 1;
    comboTimer = 0;
    wave = 1;
    bossSpawned = false;
    spawnTimer = 0;
    healthPackSpawnTimer = 0;
    nextHealthPackSpawnTime = 20 + Math.random() * 10;
    firstHealthPackSpawned = false;

    updateUI();
    
    gameState = 'playing';
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    gameUI.classList.remove('hidden');
    
    if (isMobile()) {
        joystick.classList.remove('hidden');
    }
}

function gameLoop(delta) {
    if (gameState === 'playing') {
        update(delta);
    }
}

function update(delta) {
    gameTime += app.ticker.elapsedMS / 1000;
    spawnTimer += app.ticker.elapsedMS / 1000;
    healthPackSpawnTimer += app.ticker.elapsedMS / 1000;
    comboTimer += app.ticker.elapsedMS / 1000;
    
    // Combo decay
    if (comboTimer > (playerStats.comboMaster ? 8 : 5)) {
        combo = Math.max(1, combo - 1);
        comboTimer = 0;
    }
    
    // Wave progression
    wave = Math.floor(gameTime / 45) + 1;
    
    // Enemy spawning
    if (spawnTimer > getSpawnInterval()) {
        spawnEnemies();
        spawnTimer = 0;
    }
    
    // Boss spawning every 3 minutes
    if (!bossSpawned && gameTime > 0 && Math.floor(gameTime / 180) > Math.floor((gameTime - app.ticker.elapsedMS / 1000) / 180)) {
        spawnBoss();
    }

    // Health pack spawning
    const needHealing = player && player.hp < playerStats.maxHp * 0.7;
    const canSpawnFirstTime = !firstHealthPackSpawned && needHealing;
    const canSpawnRegularly = firstHealthPackSpawned && healthPackSpawnTimer > nextHealthPackSpawnTime;

    if (canSpawnFirstTime || canSpawnRegularly) {
        spawnHealthPack();
        healthPackSpawnTimer = 0;
        nextHealthPackSpawnTime = 25 + Math.random() * 15;
        if (canSpawnFirstTime) {
            firstHealthPackSpawned = true;
        }
    }
    
    // Update game objects
    player.update(delta);
    projectiles.forEach(p => p.update(delta));
    enemies.forEach(e => e.update(delta));
    bosses.forEach(b => b.update(delta));
    xpOrbs.forEach(orb => orb.update(delta));
    healthPacks.forEach(pack => pack.update(delta));
    particles = particles.filter(p => {
        p.update(delta);
        if (p.life <= 0) {
            p.destroy();
            return false;
        }
        return true;
    });

    checkCollisions();
    cleanupProjectiles();
    updateUI();
}

function checkCollisions() {
    // Player projectiles vs Enemies
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const proj = projectiles[i];
        let hit = false;
        
        // Check enemies
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            if (isColliding(proj, enemy)) {
                enemy.takeDamage(proj.damage);
                
                // Freeze effect
                if (playerStats.freezeShots) {
                    enemy.freeze();
                }
                
                hit = true;
                if (proj.pierceCount <= 0) {
                    proj.explode();
                    proj.destroy();
                    projectiles.splice(i, 1);
                    break;
                } else {
                    proj.pierceCount--;
                }
            }
        }
        
        // Check bosses
        if (!hit) {
            for (let j = bosses.length - 1; j >= 0; j--) {
                const boss = bosses[j];
                if (isColliding(proj, boss)) {
                    boss.takeDamage(proj.damage);
                    hit = true;
                    if (proj.pierceCount <= 0) {
                        proj.explode();
                        proj.destroy();
                        projectiles.splice(i, 1);
                        break;
                    } else {
                        proj.pierceCount--;
                    }
                }
            }
        }
    }
    
    // Player vs Enemies
    enemies.forEach(enemy => {
        if (isColliding(player, enemy)) {
            player.takeDamage(enemy.damage);
        }
    });
    
    // Player vs Bosses
    bosses.forEach(boss => {
        if (isColliding(player, boss)) {
            player.takeDamage(boss.damage);
        }
    });
    
    // Player vs XP Orbs
    for (let i = xpOrbs.length - 1; i >= 0; i--) {
        const orb = xpOrbs[i];
        if (isColliding(orb, player)) {
            player.addXp(orb.value);
            orb.destroy();
            xpOrbs.splice(i, 1);
        }
    }
    
    // Player vs Health Packs
    for (let i = healthPacks.length - 1; i >= 0; i--) {
        const pack = healthPacks[i];
        if (isColliding(player, pack)) {
            sounds.heal.play();
            player.hp = Math.min(playerStats.maxHp, player.hp + pack.healAmount);
            
            // Heal particles
            for (let j = 0; j < 5; j++) {
                particles.push(new Particle(player.x, player.y, 'levelUp'));
            }
            
            pack.destroy();
            healthPacks.splice(i, 1);
        }
    }
}

function updateCombo() {
    combo = Math.min(combo + 1, 50);
    maxCombo = Math.max(maxCombo, combo);
    comboTimer = 0;
    
    // Combo sound effect
    if (combo % 5 === 0) {
        sounds.combo.play();
        showComboNotification();
    }
}

function showComboNotification() {
    const comboDiv = document.createElement('div');
    comboDiv.className = 'combo-display';
    comboDiv.textContent = `${combo}x COMBO!`;
    gameContainer.appendChild(comboDiv);
    
    setTimeout(() => {
        gameContainer.removeChild(comboDiv);
    }, 2000);
}

function spawnBoss() {
    if (bosses.length > 0) return;
    
    bossSpawned = true;
    sounds.bossWarning.play();
    
    // Show boss warning
    bossWarning.classList.remove('hidden');
    setTimeout(() => {
        bossWarning.classList.add('hidden');
    }, 3000);
    
    // Spawn boss after warning
    setTimeout(() => {
        const edge = Math.floor(Math.random() * 4);
        let x, y;
        if (edge === 0) { x = app.screen.width / 2; y = -100; }
        else if (edge === 1) { x = app.screen.width + 100; y = app.screen.height / 2; }
        else if (edge === 2) { x = app.screen.width / 2; y = app.screen.height + 100; }
        else { x = -100; y = app.screen.height / 2; }
        
        bosses.push(new Boss(x, y));
    }, 2000);
}

function isColliding(obj1, obj2) {
    if (!obj1 || !obj2 || !obj1.sprite || !obj2.sprite) return false;
    const b1 = obj1.sprite.getBounds();
    const b2 = obj2.sprite.getBounds();
    return b1.x < b2.x + b2.width &&
           b1.x + b1.width > b2.x &&
           b1.y < b2.y + b2.height &&
           b1.y + b1.height > b2.y;
}

function findNearestEnemy(x, y) {
    let nearest = null;
    let nearestDist = Infinity;
    
    enemies.forEach(enemy => {
        const dist = Math.hypot(x - enemy.x, y - enemy.y);
        if (dist < nearestDist) {
            nearest = enemy;
            nearestDist = dist;
        }
    });
    
    bosses.forEach(boss => {
        const dist = Math.hypot(x - boss.x, y - boss.y);
        if (dist < nearestDist) {
            nearest = boss;
            nearestDist = dist;
        }
    });
    
    return nearest;
}

function spawnEnemies() {
    const numEnemies = Math.floor(2 + wave * 1.3);
    for (let i = 0; i < numEnemies; i++) {
        const edge = Math.floor(Math.random() * 4);
        let x, y;
        if (edge === 0) { x = Math.random() * app.screen.width; y = -60; } 
        else if (edge === 1) { x = app.screen.width + 60; y = Math.random() * app.screen.height; } 
        else if (edge === 2) { x = Math.random() * app.screen.width; y = app.screen.height + 60; } 
        else { x = -60; y = Math.random() * app.screen.height; }
        
        let enemyType = 'PaperHands';
        if (gameTime > 120 && Math.random() < 0.25) enemyType = 'Bear';
        if (gameTime > 240 && Math.random() < 0.15) enemyType = 'Whale';
        
        enemies.push(new Enemy(x, y, enemyType));
    }
}

function spawnHealthPack() {
    if (healthPacks.length > 3) return;
    const topPadding = 120;
    const sidePadding = 60;
    const x = sidePadding + Math.random() * (app.screen.width - sidePadding * 2);
    const y = topPadding + Math.random() * (app.screen.height - topPadding - sidePadding);
    healthPacks.push(new HealthPack(x, y));
}

function cleanupProjectiles() {
    projectiles = projectiles.filter((p, i) => {
        if (p.x < -50 || p.x > app.screen.width + 50 || p.y < -50 || p.y > app.screen.height + 50) {
            p.destroy();
            return false;
        }
        return true;
    });
}

function getSpawnInterval() { 
    return Math.max(0.6, 3.5 - gameTime / 90); 
}

function updateUI() {
    const minutes = Math.floor(gameTime / 60).toString().padStart(2, '0');
    const seconds = Math.floor(gameTime % 60).toString().padStart(2, '0');
    timerDisplay.textContent = `${minutes}:${seconds}`;
    killCountDisplay.textContent = killCount;
    scoreText.textContent = score.toLocaleString();
    comboText.textContent = `x${combo}`;
    waveText.textContent = `Волна ${wave}`;
}

function endGame() {
    gameState = 'gameover';
    finalTime.textContent = timerDisplay.textContent;
    finalKills.textContent = killCount;
    finalScore.textContent = score.toLocaleString();
    finalLevel.textContent = playerStats.level;
    finalCombo.textContent = `x${maxCombo}`;
    gameOverScreen.classList.remove('hidden');
    gameUI.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    if (joystick) {
        joystick.classList.add('hidden');
    }
}

function showLevelUpModal() {
    levelUpModal.classList.remove('hidden');
    upgradeOptionsContainer.innerHTML = '';
    
    // Filter upgrades by rarity and availability
    let availableUpgrades = enhancedUpgradePool.filter(upgrade => {
        if (upgrade.id === 'multishot' && playerStats.projectileCount >= 8) return false;
        if (upgrade.id === 'piercing' && playerStats.piercing >= 10) return false;
        if (upgrade.id === 'homing' && playerStats.homingShots) return false;
        if (upgrade.id === 'explosive' && playerStats.explosiveShots) return false;
        if (upgrade.id === 'freeze' && playerStats.freezeShots) return false;
        if (upgrade.id === 'comboMaster' && playerStats.comboMaster) return false;
        return true;
    });
    
    // Weighted random selection based on rarity
    const chosenUpgrades = [];
    for (let i = 0; i < 3; i++) {
        if (availableUpgrades.length === 0) break;
        
        // Rarity weights
        const rarityWeights = { common: 50, uncommon: 25, rare: 15, epic: 10 };
        const totalWeight = availableUpgrades.reduce((sum, upgrade) => sum + rarityWeights[upgrade.rarity], 0);
        
        let random = Math.random() * totalWeight;
        let selectedUpgrade = null;
        
        for (const upgrade of availableUpgrades) {
            random -= rarityWeights[upgrade.rarity];
            if (random <= 0) {
                selectedUpgrade = upgrade;
                break;
            }
        }
        
        if (selectedUpgrade) {
            chosenUpgrades.push(selectedUpgrade);
            availableUpgrades = availableUpgrades.filter(u => u !== selectedUpgrade);
        }
    }
    
    chosenUpgrades.forEach(upgrade => {
        const btn = document.createElement('button');
        btn.className = 'upgrade-btn text-left w-full p-4 rounded-lg';
        
        const rarityColors = {
            common: 'text-gray-300',
            uncommon: 'text-green-300', 
            rare: 'text-blue-300',
            epic: 'text-purple-300'
        };
        
        btn.innerHTML = `
            <div class="font-bold text-lg ${rarityColors[upgrade.rarity]}">${upgrade.title}</div>
            <div class="text-sm text-gray-200">${upgrade.description}</div>
            <div class="text-xs ${rarityColors[upgrade.rarity]} mt-1">${upgrade.rarity.toUpperCase()}</div>
        `;
        btn.onclick = () => {
            upgrade.apply();
            levelUpModal.classList.add('hidden');
            setTimeout(() => {
                gameState = 'playing';
            }, 100);
        };
        upgradeOptionsContainer.appendChild(btn);
    });
}

function togglePauseGame() {
    if (gameState === 'playing') {
        gameState = 'paused';
        pauseScreen.classList.remove('hidden');
        gameUI.classList.add('hidden');
    } else if (gameState === 'paused') {
        gameState = 'playing';
        pauseScreen.classList.add('hidden');
        gameUI.classList.remove('hidden');
    }
}

// Mobile controls
function isMobile() { 
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent); 
}

function setupJoystick() {
    joystick = document.getElementById('joystick');
    const stick = joystick.querySelector('.joystick-stick');
    
    function handleTouch(e) {
        e.preventDefault();
        const touch = e.touches[0];
        joystickActive = true;
        joystick.style.left = `${touch.clientX - 60}px`;
        joystick.style.top = `${touch.clientY - 60}px`;
        joystickPos = { x: touch.clientX, y: touch.clientY };
    }
    
    function handleMove(e) {
        if (!joystickActive) return;
        e.preventDefault();
        const touch = e.touches[0];
        const deltaX = touch.clientX - joystickPos.x;
        const deltaY = touch.clientY - joystickPos.y;
        const dist = Math.hypot(deltaX, deltaY);
        const maxDist = 60;
        const clampedDist = Math.min(dist, maxDist);
        const angle = Math.atan2(deltaY, deltaX);
        joystickDir.x = Math.cos(angle) * (clampedDist / maxDist);
        joystickDir.y = Math.sin(angle) * (clampedDist / maxDist);
        stick.style.transform = `translate(${Math.cos(angle) * clampedDist}px, ${Math.sin(angle) * clampedDist}px)`;
    }
    
    function handleEnd(e) {
        joystickActive = false;
        joystickDir = { x: 0, y: 0 };
        stick.style.transform = `translate(0px, 0px)`;
    }
    
    app.view.addEventListener('touchstart', handleTouch, { passive: false });
    app.view.addEventListener('touchmove', handleMove, { passive: false });
    app.view.addEventListener('touchend', handleEnd, { passive: false });
}