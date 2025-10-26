import { Component, OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-hero',
  templateUrl: './hero.html',
  styleUrls: ['./hero.css']
})
export class Hero implements OnInit, OnDestroy {

  images: string[] = [
    'assets/flynn/1.jpg',
    'assets/flynn/2.jpg',
    'assets/flynn/3.jpg',
    'assets/flynn/4.jpg',
    'assets/flynn/5.jpg',
    'assets/flynn/6.jpg',
    'assets/flynn/7.jpg',
    'assets/flynn/8.jpg',
    'assets/flynn/9.jpg',
    'assets/flynn/10.jpg'
  ];

  currentImage: string = this.images[0];
  private intervalId: any;

  ngOnInit(): void {
    this.intervalId = setInterval(() => {
      const random = Math.floor(Math.random() * this.images.length);
      this.currentImage = this.images[random];
    }, 6000);
  }

  ngOnDestroy(): void {
    if (this.intervalId) clearInterval(this.intervalId);
  }
}
