import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hero.html',
  styleUrls: ['./hero.css']
})
export class Hero implements OnInit, OnDestroy {

  images: string[] = [
    'assets/flynn/1.jpeg',
    'assets/flynn/2.jpeg',
    'assets/flynn/3.jpeg',
    'assets/flynn/4.jpeg',
    'assets/flynn/5.jpeg',
    'assets/flynn/6.jpeg',
    'assets/flynn/7.jpeg',
    'assets/flynn/8.jpeg',
    'assets/flynn/9.jpeg',
    'assets/flynn/10.jpeg'
  ];

  currentImage: string = this.images[0];
  private intervalId: any;

  ngOnInit(): void {
    this.startImageRotation();
  }

  ngOnDestroy(): void {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  startImageRotation(): void {
    this.intervalId = setInterval(() => {
      const next = this.getRandomImage(this.currentImage);
      this.currentImage = next;
    }, 3000);
  }

  getRandomImage(current: string): string {
    const otherImages = this.images.filter(img => img !== current);
    const randomIndex = Math.floor(Math.random() * otherImages.length);
    return otherImages[randomIndex];
  }
}
